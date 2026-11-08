import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test'
import { $mode, setMode } from '../../../src/app/store/mode'
import { setQuery } from '../../../src/app/store/query'
import { $analyzeRequest } from '../../../src/features/analyze'
import {
  $analysis,
  analyzeMatch,
  initFind,
  refreshAnalysis,
  toggleSearch,
} from '../../../src/features/find/run'
import {
  defaultQueryState,
  fromQueryJson,
} from '../../../src/features/query/query'
import { initialCoordinatorState } from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'
import { loadEngine } from '../../engine/engine'
import {
  installStubWorkers,
  postedTypes,
  StubWorker,
  waitFor,
} from '../search/harness'

installStubWorkers()
beforeAll(loadEngine)
beforeEach(() => searchStore.setState(() => initialCoordinatorState()))
afterEach(() => {
  searchStore.setState((state) => initialCoordinatorState(state.total))
  setQuery(defaultQueryState())
  setMode('analyze')
  $analyzeRequest.set(undefined)
  localStorage.clear()
})

const impossible = fromQueryJson(
  '{"auto_apply_trinket":true,"max_depth":6,"requirements":[{"item":"wand_lightning","upgrade":{"at_least":3}}]}'
)
const possible = fromQueryJson(
  '{"auto_apply_trinket":true,"max_depth":24,"requirements":[{"kind":"ring"}]}'
)

describe('analysis', () => {
  it('has no estimate for an empty query', async () => {
    expect(await refreshAnalysis()).toBeUndefined()
    expect($analysis.get()).toBeUndefined()
  })

  it("reports an impossible query with the engine's reason", async () => {
    setQuery(impossible)
    await refreshAnalysis()
    expect($analysis.get()).toEqual({
      valid: true,
      impossible: true,
      probability: null,
      notes: [
        'Requirement 1 (Wand of lightning) needs floor 7 or later, beyond its floor limit.',
      ],
    })
  })

  it('reports the probability of a possible query', async () => {
    setQuery(possible)
    await refreshAnalysis()
    expect($analysis.get()).toMatchObject({ valid: true, impossible: false })
  })
})

describe('toggleSearch', () => {
  it('does not start an impossible or empty query', async () => {
    await toggleSearch()
    setQuery(impossible)
    await toggleSearch()
    expect(searchStore.state.state).toBe('idle')
    expect(StubWorker.posted).toEqual([])
  })

  it('starts the saved query, then cancels it', async () => {
    setQuery(possible)
    await toggleSearch()
    await waitFor(() => expect(postedTypes()).toContain('search:start'))
    expect(searchStore.state.state).toBe('running')
    expect(searchStore.state.query).toMatchObject({
      requirements: [{ kind: 'ring' }],
    })
    await toggleSearch()
    expect(searchStore.state.state).toBe('stopping')
    expect(postedTypes()).toContain('search:stop')
  })
})

describe('initFind', () => {
  const ctrlEnter = () =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })
    )

  it('starts a search on Ctrl+Enter only while Find is open', async () => {
    const stop = initFind()
    try {
      setQuery(possible)
      ctrlEnter()
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(postedTypes()).not.toContain('search:start')
      setMode('find')
      ctrlEnter()
      await waitFor(() => expect(postedTypes()).toContain('search:start'))
    } finally {
      stop()
    }
  })

  it('asks before leaving only while a search runs', () => {
    const stop = initFind()
    try {
      const leave = () => {
        const event = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(event)
        return event.defaultPrevented
      }
      expect(leave()).toBe(false)
      searchStore.setState((state) => ({ ...state, state: 'running' }))
      expect(leave()).toBe(true)
      searchStore.setState((state) => ({ ...state, state: 'stopping' }))
      expect(leave()).toBe(true)
      searchStore.setState((state) => ({ ...state, state: 'cancelled' }))
      expect(leave()).toBe(false)
    } finally {
      stop()
    }
  })
})

it('hands a result to Analyze with the query and trinket that found it', () => {
  const query = { requirements: [{ kind: 'ring' as const }] }
  searchStore.setState((state) => ({ ...state, state: 'completed', query }))
  setMode('find')
  analyzeMatch({ code: 'AAA-AAA-AAB', value: 1, selectedTrinket: null })
  expect($mode.get()).toBe('analyze')
  expect($analyzeRequest.get()).toEqual({
    results: 1,
    seed: 'AAA-AAA-AAB',
    query,
    trinket: 'none',
  })
  analyzeMatch({ code: 'AAA-AAA-AAC', value: 2 })
  expect($analyzeRequest.get()).toEqual({
    seed: 'AAA-AAA-AAC',
    results: 1,
    query,
  })
})
