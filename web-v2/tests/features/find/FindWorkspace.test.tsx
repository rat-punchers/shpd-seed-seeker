import { afterEach, beforeEach, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $mode, setMode } from '../../../src/app/store/mode'
import type { SeedReportRequest } from '../../../src/engine/types'
import { $analyzeRequest } from '../../../src/features/analyze'
import { FindWorkspace } from '../../../src/features/find'
import {
  $previewPicks,
  initPreviewKeys,
} from '../../../src/features/find/preview/selection'
import { setPreviewReportClient } from '../../../src/features/find/preview/use-preview-report'
import {
  type CoordinatorState,
  initialCoordinatorState,
} from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'
import { realReport } from '../analyze/fixtures'

let root: Root | undefined
let container: HTMLDivElement
const fixture = await realReport('aaa-aaa-aaa.json')
const requests: SeedReportRequest[] = []

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  requests.length = 0
  setPreviewReportClient((request) => {
    requests.push(request)
    return {
      promise: Promise.resolve({
        ...fixture,
        seed: { ...fixture.seed, code: request.seed },
      }),
      cancel: () => {},
    }
  })
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
  $previewPicks.set({})
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

it('lists the matches as rows that open in Analyze', () => {
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
  const cards = [...container.querySelectorAll('[data-testid="result-row"]')]
  expect(cards.map((card) => card.querySelector('h3')?.textContent)).toEqual([
    'AAA-AAA-AAB',
    'AAA-AAA-AAC',
  ])
  expect(cards[0]?.textContent).toContain('Parchment Scrap')
  expect(cards[1]?.textContent).toContain('No trinket')

  const analyze = cards[0]?.querySelector<HTMLButtonElement>(
    '[aria-label="Analyze seed AAA-AAA-AAB"]'
  )
  act(() => analyze?.click())
  expect($mode.get()).toBe('analyze')
  expect($analyzeRequest.get()).toEqual({
    results: 1,
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

/** Lets the preview's debounce run and its report land. */
const settle = () =>
  act(async () => {
    await Bun.sleep(150)
  })
const preview = () =>
  container.querySelector<HTMLElement>('[aria-label="Seed preview"]')
const previewSeed = () =>
  preview()?.querySelector('[data-preview-seed]')?.textContent

it('previews the first match, a clicked one, and the next with J', async () => {
  const stopKeys = initPreviewKeys()
  show({
    state: 'completed',
    query,
    matches: [
      { code: 'AAA-AAA-AAB', value: 1, selectedTrinket: 'parchment_scrap' },
      { code: 'AAA-AAA-AAC', value: 2, selectedTrinket: null },
      { code: 'AAA-AAA-AAD', value: 3 },
    ],
  })
  expect(previewSeed()).toBe('AAA-AAA-AAB')
  await settle()
  expect(requests).toEqual([
    { seed: 'AAA-AAA-AAB', query, trinket: 'parchment_scrap' },
  ])
  expect(preview()?.textContent).toContain('Result 1 of 3')
  expect(
    preview()?.querySelectorAll('[data-floor-depth]').length
  ).toBeGreaterThan(0)
  const selected = () =>
    container.querySelector('[data-testid="result-row"][data-selected]')
  expect(selected()?.querySelector('h3')?.textContent).toBe('AAA-AAA-AAB')

  const second = container.querySelector<HTMLButtonElement>(
    '[aria-label="Preview AAA-AAA-AAC"]'
  )
  act(() => second?.click())
  expect(previewSeed()).toBe('AAA-AAA-AAC')
  expect(selected()?.querySelector('h3')?.textContent).toBe('AAA-AAA-AAC')
  await settle()
  expect(requests.at(-1)).toEqual({
    seed: 'AAA-AAA-AAC',
    query,
    trinket: 'none',
  })

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
  })
  expect(previewSeed()).toBe('AAA-AAA-AAD')
  await settle()
  expect(requests.at(-1)).toEqual({ seed: 'AAA-AAA-AAD', query })
  // The last result has no next one.
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
  })
  expect(previewSeed()).toBe('AAA-AAA-AAD')

  const open = [...(preview()?.querySelectorAll('button') ?? [])].find(
    (button) => button.textContent?.includes('Analyze seed')
  )
  act(() => open?.click())
  expect($analyzeRequest.get()).toEqual({
    results: 1,
    seed: 'AAA-AAA-AAD',
    query,
  })
  stopKeys()
})

it('asks again only for a seed it has not previewed', async () => {
  show({
    state: 'completed',
    query,
    matches: [
      { code: 'AAA-AAA-AAB', value: 1, selectedTrinket: null },
      { code: 'AAA-AAA-AAC', value: 2, selectedTrinket: null },
    ],
  })
  await settle()
  act(() => $previewPicks.set({ 1: 'AAA-AAA-AAC' }))
  await settle()
  act(() => $previewPicks.set({ 1: 'AAA-AAA-AAB' }))
  expect(previewSeed()).toBe('AAA-AAA-AAB')
  expect(
    preview()
      ?.querySelector('[data-seed-preview]')
      ?.getAttribute('data-seed-preview')
  ).toBe('AAA-AAA-AAB')
  await settle()
  expect(requests.map((request) => request.seed)).toEqual([
    'AAA-AAA-AAB',
    'AAA-AAA-AAC',
  ])
})
