import { afterEach, beforeEach, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $mode, setMode } from '../../../src/app/store/mode'
import { $analyzeRequest } from '../../../src/features/analyze'
import { FindWorkspace } from '../../../src/features/find'
import {
  type CoordinatorState,
  initialCoordinatorState,
} from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'

let root: Root | undefined
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  searchStore.setState(() => initialCoordinatorState())
  setMode('find')
  container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(
      <TooltipProvider>
        <FindWorkspace />
      </TooltipProvider>
    )
  })
})

afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
  searchStore.setState(() => initialCoordinatorState())
  $analyzeRequest.set(undefined)
  localStorage.clear()
})

const show = (state: Partial<CoordinatorState>) =>
  act(() => searchStore.setState((current) => ({ ...current, ...state })))
const query = { requirements: [{ kind: 'ring' as const }] }

it('starts empty', () => {
  expect(container.querySelector('[aria-level="2"]')?.textContent).toBe(
    'No search yet'
  )
})

it('lists the matches as cards that open in Analyze', () => {
  show({
    state: 'completed',
    query,
    tested: 1_200,
    elapsed: 2_000,
    matches: [
      { code: 'AAA-AAA-AAB', value: 1, selectedTrinket: 'parchment_scrap' },
      { code: 'AAA-AAA-AAC', value: 2, selectedTrinket: null },
    ],
  })
  expect(container.textContent).toContain('Completed')
  expect(container.textContent).toContain('2 seeds')
  expect(container.textContent).toContain('Tested 1.20 K in 2s')
  const cards = [...container.querySelectorAll('[data-testid="result-card"]')]
  expect(cards.map((card) => card.querySelector('h3')?.textContent)).toEqual([
    'AAA-AAA-AAB',
    'AAA-AAA-AAC',
  ])
  expect(cards[0]?.textContent).toContain('Parchment Scrap')
  expect(cards[1]?.textContent).toContain('No trinket')

  const analyze = [...(cards[0]?.querySelectorAll('button') ?? [])].find(
    (button) => button.textContent?.includes('Analyze seed')
  )
  act(() => analyze?.click())
  expect($mode.get()).toBe('analyze')
  expect($analyzeRequest.get()).toEqual({
    seed: 'AAA-AAA-AAB',
    query,
    trinket: 'parchment_scrap',
  })
})

it('reports a completed search that matched nothing', () => {
  show({ state: 'completed', query })
  expect(container.textContent).toContain(
    'No seeds matched this query in the searched range.'
  )
})

it('shows live stats while scanning and the reason a search failed', () => {
  show({ state: 'running', query, tested: 5_000, rate: 2_500 })
  expect(container.textContent).toContain('Searching')
  expect(container.textContent).toContain('Tested5 K')
  expect(container.textContent).toContain('2.50 K/s')
  expect(container.textContent).toContain(
    'Matching seeds will appear here as they are found.'
  )
  show({ state: 'failed', error: 'worker crashed' })
  const alert = container.querySelector('[role="alert"]')
  expect(alert?.textContent).toContain('Search failed')
  expect(alert?.textContent).toContain('worker crashed')
})

it('notes the result limit once a capped run ends', () => {
  show({
    state: 'completed',
    query,
    capped: true,
    matches: [{ code: 'AAA-AAA-AAB', value: 1 }],
  })
  expect(container.textContent).toContain('Result limit reached (1,024 seeds).')
})
