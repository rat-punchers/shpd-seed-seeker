import type { ParsedSeed, QueryDocument } from '../../engine/types'
import {
  applyProgress,
  initialCoordinatorState,
  markWorkerDone,
  type RefineSummary,
  runSaturated,
  type SearchStatus,
  settleRun,
} from './coordinator-state'
import {
  answerFilter,
  fanOutFilter,
  filterChunkCount,
  poolBySource,
} from './filter'
import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol'
import {
  distributeSegments,
  remainingSegments,
  resumedRunState,
  segmentsLength,
} from './refine'
import { searchStore } from './store'
import {
  advanceTraversalStart,
  partitionRotated,
  randomTraversalStart,
  type SeedRange,
} from './traversal'

export { clearResults, loadImportedResults, searchStore } from './store'

/** How long a cancel waits for every worker's acknowledgment before the
 * coordinator force-finalizes the stop. Workers acknowledge within one chunk
 * normally; the timeout only covers a worker that died or never started. */
const STOP_ACK_TIMEOUT_MS = 2_000

/** Runs searches on a pool of scan workers: each start re-verifies the
 * retained pool, then scans on, resuming coverage for an unchanged query. */
type FilterRestore = {
  sessionId: number
  state: SearchStatus
  refined?: RefineSummary
}

export class SearchCoordinator {
  private workers: Worker[] = []
  private sessionId = 0
  private totalSeeds = 0
  private nextTraversalStart: number | undefined
  private startedWorkers = 0
  /** Present while a refine's filter phase runs: how to restore the previous
   * finished state if the filter is cancelled or fails. */
  private filterRestore: FilterRestore | undefined

  constructor(totalSeeds: number) {
    this.totalSeeds = totalSeeds
    searchStore.setState(() => initialCoordinatorState(totalSeeds))
  }

  private ensureWorkers(count: number): Worker[] {
    const target = Math.max(1, Math.floor(count) || 1)
    while (this.workers.length < target) {
      const workerId = this.workers.length
      const worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      })
      worker.addEventListener(
        'message',
        (event: MessageEvent<SearchWorkerResponse>) =>
          this.onMessage(workerId, event.data)
      )
      this.workers.push(worker)
    }
    return this.workers.slice(0, target)
  }

  /** Every search rechecks the entire retained pool, then scans for more. */
  start(
    query: QueryDocument,
    workerCount = Math.max(1, navigator.hardwareConcurrency ?? 4)
  ): void {
    const previous = searchStore.state
    if (previous.state === 'running' || previous.state === 'stopping') return
    const sessionId = ++this.sessionId
    const pool = previous.target
    const seeds = pool?.matches ?? []
    const sameQuery =
      previous.queryJson === JSON.stringify(query) &&
      (previous.state === 'completed' || previous.state === 'cancelled')
    const remainder = sameQuery
      ? remainingSegments(previous.segments, previous.workerScanned)
      : partitionRotated(this.totalSeeds, 1, this.claimTraversalStart()).flat()
    this.startedWorkers = 0
    this.filterRestore = {
      sessionId,
      state: previous.state,
      refined: previous.refined,
    }
    searchStore.setState((state) => ({
      ...state,
      sessionId,
      state: 'running',
      filtering: true,
      refined: { kept: 0, of: seeds.length },
      error: undefined,
    }))
    void Promise.all(
      [...poolBySource(pool, query)].map(([source, entries]) =>
        fanOutFilter(
          this.ensureWorkers(filterChunkCount(entries.length, workerCount)),
          JSON.stringify(query),
          entries,
          source
        )
      )
    )
      .then((parts) => parts.flat().sort((a, b) => a.value - b.value))
      .then((kept) => {
        if (this.filterRestore?.sessionId !== sessionId) return
        this.filterRestore = undefined
        this.beginResumedScan(query, remainder, kept, seeds.length, workerCount)
      })
      .catch((error: unknown) =>
        this.restoreAfterFilter(
          sessionId,
          error instanceof Error ? error.message : String(error)
        )
      )
  }

  /** Puts the store back into the previous finished state after a cancelled
   * or failed filter phase. Matches and coverage were never touched. */
  private restoreAfterFilter(sessionId: number, error?: string): void {
    const restore = this.filterRestore
    if (restore?.sessionId !== sessionId) return
    this.filterRestore = undefined
    searchStore.setState((state) => ({
      ...state,
      state: restore.state,
      filtering: false,
      refined: restore.refined,
      error,
    }))
  }

  private beginResumedScan(
    query: QueryDocument,
    remainder: SeedRange[],
    kept: ParsedSeed[],
    previousCount: number,
    workerCount: number
  ): void {
    const sessionId = this.sessionId
    const queryJson = JSON.stringify(query)
    const run = resumedRunState(query, remainder, kept, previousCount)
    // An unchanged query can have exhausted its scan range.
    if (segmentsLength(remainder) === 0) {
      searchStore.setState((state) =>
        settleRun({
          ...state,
          ...run,
          state: 'completed',
          workerCount: 0,
          segments: [remainder],
        })
      )
      return
    }
    const workers = this.ensureWorkers(workerCount)
    const segments = distributeSegments(remainder, workers.length)
    searchStore.setState((state) => ({
      ...state,
      ...run,
      state: 'running',
      workerCount: workers.length,
      segments,
    }))
    this.startedWorkers = workers.length
    workers.forEach((worker, index) => {
      worker.postMessage({
        type: 'search:start',
        queryJson,
        segments: segments[index] ?? [],
        sessionId,
      } satisfies SearchWorkerRequest)
    })
  }

  // Like the native session layer, each search starts one golden-ratio turn
  // beyond the previous one so identical queries surface different seeds.
  private claimTraversalStart(): number {
    const current =
      this.nextTraversalStart ?? randomTraversalStart(this.totalSeeds)
    this.nextTraversalStart = advanceTraversalStart(current, this.totalSeeds)
    return current
  }

  private stopWorkers(sessionId: number): void {
    for (const worker of this.workers)
      worker.postMessage({
        type: 'search:stop',
        sessionId,
      } satisfies SearchWorkerRequest)
  }

  cancel(): void {
    const current = searchStore.state
    if (current.state !== 'running' && current.state !== 'stopping') return
    if (current.filtering) {
      // Still re-verifying for a refine: no worker owns this session yet, so
      // fall straight back to the previous finished results.
      this.restoreAfterFilter(current.sessionId)
      return
    }
    if (this.startedWorkers === 0) {
      searchStore.setState((state) =>
        settleRun({
          ...state,
          state: 'cancelled',
          elapsed: performance.now() - state.startedAt,
        })
      )
      return
    }
    const sessionId = current.sessionId
    this.stopWorkers(sessionId)
    // Workers acknowledge with search:stopped carrying their exact final
    // positions; the state turns cancelled once every worker has reported.
    // Cancel stays available while stopping (it re-broadcasts), and a
    // watchdog finalizes the stop even if an acknowledgment never arrives.
    if (current.state === 'running') {
      searchStore.setState((state) => ({
        ...state,
        state: 'stopping',
        elapsed: performance.now() - state.startedAt,
      }))
    }
    window.setTimeout(() => {
      const state = searchStore.state
      if (state.sessionId === sessionId && state.state === 'stopping') {
        searchStore.setState((stuck) =>
          settleRun({
            ...stuck,
            state: runSaturated(stuck) ? 'completed' : 'cancelled',
          })
        )
      }
    }, STOP_ACK_TIMEOUT_MS)
  }

  private onMessage(workerId: number, message: SearchWorkerResponse): void {
    // Filter replies belong to a fan-out request, not a scan session.
    if (message.type === 'filter:result' || message.type === 'filter:error') {
      answerFilter(message)
      return
    }
    if (message.sessionId !== searchStore.state.sessionId) return
    const now = performance.now()
    if (message.type === 'search:progress') {
      searchStore.setState((state) =>
        applyProgress(state, { ...message, workerId, now })
      )
      if (runSaturated(searchStore.state)) this.stopWorkers(message.sessionId)
    }
    if (message.type === 'search:done' || message.type === 'search:stopped') {
      const kind = message.type === 'search:done' ? 'done' : 'stopped'
      searchStore.setState((state) =>
        markWorkerDone(state, {
          sessionId: message.sessionId,
          workerId,
          scanned: message.scanned,
          kind,
          now,
        })
      )
    }
    if (message.type === 'search:error') {
      // A failed run cannot become a refine base: its coverage is unknown.
      this.stopWorkers(message.sessionId)
      searchStore.setState((state) => ({
        ...state,
        state: 'failed',
        error: message.error,
        elapsed: now - state.startedAt,
      }))
    }
  }
}
