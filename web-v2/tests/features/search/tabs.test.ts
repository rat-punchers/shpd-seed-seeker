import { afterEach, describe, expect, it } from 'bun:test'
import { SearchCoordinator } from '../../../src/features/search/coordinator'
import {
  type CoordinatorState,
  initialCoordinatorState,
} from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'
import {
  addResultsTab,
  closeResultsTab,
  resetResultsTabs,
  resultsTabsStore,
  selectResultsTab,
  tabSearch,
} from '../../../src/features/search/tabs'
import { decodeTabs, encodeTabs } from '../../../src/features/search/tabs-codec'
import {
  baseQuery,
  installStubWorkers,
  match,
  postedTypes,
  StubWorker,
  TOTAL,
  unrelated,
  waitFor,
} from './harness'

installStubWorkers()
afterEach(resetResultsTabs)

const running = (over: Partial<CoordinatorState> = {}): CoordinatorState => ({
  ...initialCoordinatorState(TOTAL),
  sessionId: 3,
  state: 'running',
  query: baseQuery,
  queryJson: JSON.stringify(baseQuery),
  matches: [match(11)],
  segments: [[{ startSeed: 0, endSeedExclusive: TOTAL }]],
  workerScanned: { 0: [250] },
  workerCount: 1,
  rateSamples: [{ at: 1, tested: 250 }],
  target: {
    query: baseQuery,
    matches: [match(11), match(22)],
    sources: { 11: baseQuery, 22: unrelated },
  },
  ...over,
})

const roundTrip = (search: CoordinatorState) =>
  decodeTabs(encodeTabs({ tabs: [{ id: 4, search }], activeId: 4, nextId: 5 }))
    ?.tabs[0]?.search

describe('saved results tabs', () => {
  it('restores a running search as cancelled with its coverage, so Find resumes', () => {
    const restored = roundTrip(running())
    expect(restored?.state).toBe('cancelled')
    expect(restored?.workerScanned).toEqual({ 0: [250] })
    expect(restored?.segments).toEqual([
      [{ startSeed: 0, endSeedExclusive: TOTAL }],
    ])
    expect(restored?.rateSamples).toEqual([])
    expect(restored?.target?.sources).toEqual({ 11: baseQuery, 22: unrelated })
    expect(restored?.matches).toEqual([match(11)])
  })

  it('stores each source query once', () => {
    const sources = Object.fromEntries(
      Array.from({ length: 50 }, (_, value) => [value, baseQuery])
    )
    const text = encodeTabs({
      tabs: [
        {
          id: 1,
          search: running({
            target: { query: baseQuery, matches: [match(11)], sources },
          }),
        },
      ],
      activeId: 1,
      nextId: 2,
    })
    expect(text.split('"kind":"ring"').length - 1).toBeLessThan(5)
  })

  it('leaves the previous results of an interrupted refine as they were', () => {
    const restored = roundTrip(
      running({ filtering: true, refined: { kept: 0, of: 2 } })
    )
    expect(restored?.state).toBe('cancelled')
    expect(restored?.filtering).toBe(false)
    expect(restored?.refined).toBeUndefined()
    expect(roundTrip(initialCoordinatorState())?.state).toBe('idle')
  })

  it('ignores text that is not a saved tab set', () => {
    expect(decodeTabs('nope')).toBeUndefined()
    expect(decodeTabs('{"version":1,"tabs":[]}')).toBeUndefined()
  })
})

describe('results tabs', () => {
  it('adds, shows and closes tabs without reusing names', () => {
    searchStore.setState(() => running({ state: 'completed' }))
    expect(addResultsTab()).toBe(2)
    expect(searchStore.state.state).toBe('idle')
    selectResultsTab(1)
    expect(searchStore.state.matches).toEqual([match(11)])
    closeResultsTab(1)
    expect(resultsTabsStore.state.activeId).toBe(2)
    closeResultsTab(2)
    expect(resultsTabsStore.state.tabs.map((tab) => tab.id)).toEqual([2])
    expect(addResultsTab()).toBe(3)
  })

  it('keeps a search writing to its own tab while another is shown', async () => {
    const coordinator = new SearchCoordinator(TOTAL)
    coordinator.start(baseQuery, 1)
    await waitFor(() => expect(postedTypes()).toContain('search:start'))
    const sessionId = searchStore.state.sessionId
    addResultsTab()
    StubWorker.listeners[0]?.({
      data: {
        type: 'search:progress',
        sessionId,
        scanned: [100],
        matches: [match(7)],
      },
    } as MessageEvent)
    expect(tabSearch(1)?.matches).toEqual([match(7)])
    expect(searchStore.state.matches).toEqual([])
    // One search at a time, and its tab cannot be closed.
    coordinator.start(unrelated, 1)
    expect(searchStore.state.state).toBe('idle')
    closeResultsTab(1)
    expect(tabSearch(1)?.state).toBe('running')
  })
})
