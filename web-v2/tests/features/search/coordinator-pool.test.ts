import { describe, expect, it } from 'bun:test'
import type { QueryDocument } from '../../../src/engine/types'
import {
  clearResults,
  loadImportedResults,
  SearchCoordinator,
  searchStore,
} from '../../../src/features/search/coordinator'
import {
  type CoordinatorState,
  canClearResults,
  initialCoordinatorState,
} from '../../../src/features/search/coordinator-state'
import {
  baseQuery,
  installStubWorkers,
  match,
  postedTypes,
  StubWorker,
  seedFinishedRun,
  superset,
  TOTAL,
  unrelated,
  waitForFilter,
} from './harness'

installStubWorkers()

describe('clearing results', () => {
  const withState = (
    state: CoordinatorState['state'],
    matches = [match(1)]
  ): CoordinatorState => ({
    ...initialCoordinatorState(TOTAL),
    state,
    matches,
  })

  it('is unavailable while a search owns the state, or with nothing to clear', () => {
    expect(canClearResults(withState('running'))).toBe(false)
    expect(canClearResults(withState('stopping'))).toBe(false)
    expect(canClearResults(initialCoordinatorState(TOTAL))).toBe(false)
  })

  it('is available for any finished or loaded result set', () => {
    for (const state of [
      'completed',
      'cancelled',
      'failed',
      'imported',
    ] as const) {
      expect(canClearResults(withState(state))).toBe(true)
    }
    // A completed run that matched nothing is still worth clearing: it is the
    // base a later start would refine from.
    expect(canClearResults(withState('completed', []))).toBe(true)
  })

  it('leaves a running search untouched', () => {
    new SearchCoordinator(TOTAL)
    searchStore.setState((state) => ({
      ...state,
      state: 'running',
      matches: [match(7)],
      queryJson: '{}',
    }))
    clearResults()
    expect(searchStore.state.state).toBe('running')
    expect(searchStore.state.matches).toHaveLength(1)
  })
})

it('filters before a fresh traversal when automatic selection is toggled', () => {
  const coordinator = new SearchCoordinator(TOTAL)
  const query: QueryDocument = {
    max_depth: 19,
    requirements: [{ item: 'runic_blade', upgrade: 1, effect: 'Grim' }],
  }
  seedFinishedRun(query)
  const target = searchStore.state.target
  coordinator.start({ ...query, auto_apply_trinket: true }, 1)
  expect(searchStore.state.filtering).toBe(true)
  expect(searchStore.state.target).toBe(target)
  expect(postedTypes()).toEqual(['filter'])
})

it('passes saved choices to filter workers when continuing the same policy', () => {
  const coordinator = new SearchCoordinator(TOTAL)
  const query: QueryDocument = {
    auto_apply_trinket: true,
    max_depth: 19,
    requirements: [{ item: 'runic_blade', upgrade: 1, effect: 'Grim' }],
  }
  seedFinishedRun(query)
  searchStore.setState((state) => ({
    ...state,
    target: {
      ...(state.target ?? { query, matches: [] }),
      matches: [
        { ...match(11), selectedTrinket: 'parchment_scrap' },
        { ...match(22), selectedTrinket: null },
      ],
    },
  }))
  coordinator.start(query, 1)
  expect(StubWorker.posted[0]).toMatchObject({
    type: 'filter',
    baseQueryJson: JSON.stringify(query),
    seeds: [11, 22],
    trinkets: ['parchment_scrap', null],
  })
})

it("checks the entire accumulated pool with each seed's original source", async () => {
  const coordinator = new SearchCoordinator(TOTAL)
  seedFinishedRun(baseQuery)
  loadImportedResults([{ ...match(33), selectedTrinket: null }], unrelated)
  coordinator.start(superset, 1)
  const filters = StubWorker.posted.filter((m) => m.type === 'filter')
  expect(filters.map((m) => m.seeds)).toEqual([[11, 22], [33]])
  expect(filters.map((m) => JSON.parse(m.baseQueryJson ?? ''))).toEqual([
    baseQuery,
    unrelated,
  ])
  for (const filter of filters)
    StubWorker.listeners[0]?.({
      data: {
        type: 'filter:result',
        requestId: filter.requestId,
        resultJson: '[]',
      },
    } as MessageEvent)
  await waitForFilter()
  expect(searchStore.state.matches).toEqual([])
  expect(searchStore.state.target?.matches.map((m) => m.value)).toEqual([
    11, 22, 33,
  ])
  // A fully exhausted scan allows a second Search to finish after rechecking the pool.
  searchStore.setState((state) => ({
    ...state,
    state: 'completed',
    segments: [],
    workerScanned: {},
  }))
  StubWorker.posted = []
  coordinator.start(baseQuery, 1)
  expect(
    StubWorker.posted
      .filter((m) => m.type === 'filter')
      .flatMap((m) => m.seeds ?? [])
  ).toEqual([11, 22, 33])
})
