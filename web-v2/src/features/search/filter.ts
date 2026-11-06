import type { ParsedSeed, QueryDocument } from '../../engine/types'
import type { TargetState } from './coordinator-state'
import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol'

/** Smallest filter slice worth its own worker: re-verifying a seed means
 * generating its world in full, but below this many seeds the fan-out
 * overhead outweighs the generation time saved. */
const MIN_FILTER_CHUNK = 16

type FilterReply = Extract<
  SearchWorkerResponse,
  { type: 'filter:result' | 'filter:error' }
>

let nextRequestId = 0
const pending = new Map<
  number,
  { resolve: (value: ParsedSeed[]) => void; reject: (reason: Error) => void }
>()

/**
 * The retained pool grouped by the query document each seed was found with
 * (JSON), so every seed is re-verified against its own base query.
 */
export function poolBySource(
  pool: TargetState | undefined,
  query: QueryDocument
): Map<string, ParsedSeed[]> {
  const groups = new Map<string, ParsedSeed[]>()
  for (const seed of pool?.matches ?? []) {
    const source = JSON.stringify(
      pool?.sources?.[seed.value] ?? pool?.query ?? query
    )
    const entries = groups.get(source) ?? []
    entries.push(seed)
    groups.set(source, entries)
  }
  return groups
}

/** How many filter slices a seed set gets on a pool of `workerCount`. */
export function filterChunkCount(seeds: number, workerCount: number): number {
  const poolSize = Math.max(1, Math.floor(workerCount) || 1)
  return Math.min(poolSize, Math.max(1, Math.ceil(seeds / MIN_FILTER_CHUNK)))
}

/**
 * Re-verifies seeds against a query across the given workers, resolving with
 * the matching seeds in input order. The scan pool sits idle during a
 * refine's filter phase, so the set fans out over the same workers the
 * resumed scan will use. Chunks are contiguous slices, so concatenating the
 * results preserves input order.
 */
export function fanOutFilter(
  workers: Worker[],
  queryJson: string,
  seeds: ParsedSeed[],
  baseQueryJson: string
): Promise<ParsedSeed[]> {
  if (seeds.length === 0) return Promise.resolve([])
  const chunkSize = Math.ceil(seeds.length / workers.length)
  const requests = workers.map(
    (worker, index) =>
      new Promise<ParsedSeed[]>((resolve, reject) => {
        const chunk = seeds.slice(index * chunkSize, (index + 1) * chunkSize)
        const requestId = ++nextRequestId
        pending.set(requestId, { resolve, reject })
        worker.postMessage({
          type: 'filter',
          queryJson,
          baseQueryJson,
          seeds: chunk.map((match) => match.value),
          ...(chunk.every((match) => match.selectedTrinket !== undefined)
            ? { trinkets: chunk.map((match) => match.selectedTrinket ?? null) }
            : {}),
          requestId,
        } satisfies SearchWorkerRequest)
      })
  )
  return Promise.all(requests).then((parts) => parts.flat())
}

/** Settles the filter request a worker reply answers. */
export function answerFilter(message: FilterReply): void {
  const request = pending.get(message.requestId)
  if (!request) return
  pending.delete(message.requestId)
  if (message.type === 'filter:error') request.reject(new Error(message.error))
  else request.resolve(JSON.parse(message.resultJson) as ParsedSeed[])
}
