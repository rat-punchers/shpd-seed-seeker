import { describe, expect, it } from 'bun:test'
import type { QueryDocument } from '../../../src/engine/types'
import {
  clearResults,
  loadImportedResults,
  SearchCoordinator,
  searchStore,
} from '../../../src/features/search/coordinator'
import { canClearResults } from '../../../src/features/search/coordinator-state'
import {
  baseQuery,
  installStubWorkers,
  match,
  postedTypes,
  replyToFilter,
  StubWorker,
  seedFinishedRun,
  superset,
  TOTAL,
  unrelated,
  waitForFilter,
} from './harness'

installStubWorkers()

describe('implicit refine on start', () => {
  it('continues the previous run when the query only gained requirements', () => {
    const coordinator = new SearchCoordinator(TOTAL)
    seedFinishedRun(baseQuery)
    coordinator.start(superset, 2)

    const state = searchStore.state
    // The filter phase is the refine's first half: previous matches are being
    // re-verified, and they survive in the store until it succeeds.
    expect(state.state).toBe('running')
    expect(state.filtering).toBe(true)
    expect(state.refined).toEqual({ kept: 0, of: 2 })
    expect(state.matches.map((item) => item.value)).toEqual([11, 22])
    expect(postedTypes()).toEqual(['filter'])
  })

  it('continues the previous run when the query is unchanged', () => {
    const coordinator = new SearchCoordinator(TOTAL)
    seedFinishedRun(baseQuery)
    coordinator.start(baseQuery, 2)

    const state = searchStore.state
    // An unchanged query is a resume, not a rescan: the same filter phase
    // runs (it trivially keeps everything) and the previous coverage stands.
    expect(state.state).toBe('running')
    expect(state.filtering).toBe(true)
    expect(state.matches.map((item) => item.value)).toEqual([11, 22])
    expect(state.segments).toEqual([
      [{ startSeed: 0, endSeedExclusive: TOTAL }],
    ])
    expect(state.workerScanned).toEqual({ 0: [400] })
    expect(StubWorker.posted).toEqual([
      {
        type: 'filter',
        queryJson: JSON.stringify(baseQuery),
        baseQueryJson: JSON.stringify(baseQuery),
        seeds: [11, 22],
        requestId: expect.any(Number),
      },
    ])
  })

  it('keeps the results across repeated cancel/start cycles with an unchanged query', () => {
    // The QA repro: a session must survive until the user presses Clear.
    const coordinator = new SearchCoordinator(TOTAL)
    seedFinishedRun(baseQuery, 'cancelled')

    for (let cycle = 0; cycle < 3; cycle += 1) {
      coordinator.start(baseQuery, 2)
      expect(searchStore.state.filtering).toBe(true)
      expect(searchStore.state.matches.map((item) => item.value)).toEqual([
        11, 22,
      ])

      // Cancelling during the filter phase falls back to the finished run it
      // was continuing, matches and coverage intact.
      coordinator.cancel()
      expect(searchStore.state.state).toBe('cancelled')
      expect(searchStore.state.filtering).toBe(false)
      expect(searchStore.state.matches.map((item) => item.value)).toEqual([
        11, 22,
      ])
      expect(searchStore.state.workerScanned).toEqual({ 0: [400] })
    }
    // Three filter phases, and never a fresh full-space scan.
    expect(postedTypes()).toEqual(['filter', 'filter', 'filter'])
  })

  it('filters unrelated loaded seeds before starting a fresh scan', async () => {
    const coordinator = new SearchCoordinator(TOTAL)
    seedFinishedRun(baseQuery)
    coordinator.start(unrelated, 2)
    expect(searchStore.state.filtering).toBe(true)
    expect(searchStore.state.matches.map((item) => item.value)).toEqual([
      11, 22,
    ])
    replyToFilter(StubWorker.posted[0], [match(11)])
    await waitForFilter()
    expect(searchStore.state.matches.map((item) => item.value)).toEqual([11])
    expect(
      searchStore.state.segments
        .flat()
        .reduce(
          (sum, range) => sum + range.endSeedExclusive - range.startSeed,
          0
        )
    ).toBe(TOTAL)
    expect(searchStore.state.target?.matches.map((item) => item.value)).toEqual(
      [11, 22]
    )
    expect(
      StubWorker.posted
        .filter((m) => m.type === 'search:start')
        .every((m) => m.queryJson === JSON.stringify(unrelated))
    ).toBe(true)
  })

  it('starts an imported refinement with its original trinket policy', async () => {
    const coordinator = new SearchCoordinator(TOTAL)
    seedFinishedRun(baseQuery)
    loadImportedResults([match(11), match(22)], baseQuery)
    coordinator.start(superset, 1)
    replyToFilter(StubWorker.posted[0], [match(11)])
    await waitForFilter()
    const scan = StubWorker.posted.find((m) => m.type === 'search:start')
    expect(JSON.parse(scan?.queryJson ?? '')).toEqual(superset)
    expect(searchStore.state.query).toEqual(superset)
    expect(searchStore.state.total).toBe(TOTAL)
  })

  it('fans a large filter phase out across the worker pool in contiguous slices', () => {
    const coordinator = new SearchCoordinator(TOTAL)
    seedFinishedRun(baseQuery)
    const bigSet = Array.from({ length: 40 }, (_, index) => match(index + 1))
    searchStore.setState((current) => ({
      ...current,
      matches: bigSet,
      target: { query: baseQuery, matches: bigSet },
    }))
    coordinator.start(baseQuery, 2)

    // 40 seeds over 2 workers: two contiguous halves whose concatenation is
    // the original input order, so the survivors keep their discovery order.
    const posted = StubWorker.posted.filter(
      (message) => message.type === 'filter'
    )
    expect(posted.map((message) => message.seeds)).toEqual([
      bigSet.slice(0, 20).map((item) => item.value),
      bigSet.slice(20).map((item) => item.value),
    ])
  })

  it('checks the full pool when requirements are removed', () => {
    const coordinator = new SearchCoordinator(TOTAL)
    // Removing requirements still checks every retained seed.
    const targetQuery: QueryDocument = {
      requirements: [{ kind: 'ring' }, { kind: 'weapon' }],
    }
    seedFinishedRun(targetQuery)
    coordinator.start(baseQuery, 2)

    const state = searchStore.state
    expect(state.state).toBe('running')
    expect(state.filtering).toBe(true)
    expect(state.refined).toEqual({ kept: 0, of: 2 })
    expect(StubWorker.posted).toEqual([
      {
        type: 'filter',
        queryJson: JSON.stringify(baseQuery),
        baseQueryJson: JSON.stringify(targetQuery),
        seeds: [11, 22],
        requestId: expect.any(Number),
      },
    ])
  })

  it('starts fresh once the results have been cleared', async () => {
    const coordinator = new SearchCoordinator(TOTAL)
    seedFinishedRun(baseQuery)
    expect(canClearResults(searchStore.state)).toBe(true)

    clearResults()
    expect(searchStore.state.state).toBe('idle')
    expect(searchStore.state.matches).toEqual([])
    expect(searchStore.state.queryJson).toBe('')
    expect(searchStore.state.target).toBeUndefined()
    // The session counter survives so a late message from the cleared run is
    // still recognised as stale.
    expect(searchStore.state.sessionId).toBe(1)

    // Same query that refined a moment ago; with no base left it rescans.
    coordinator.start(superset, 1)
    await waitForFilter()
    expect(searchStore.state.matches).toEqual([])
    expect(postedTypes()).toEqual(['search:start'])
  })
})
