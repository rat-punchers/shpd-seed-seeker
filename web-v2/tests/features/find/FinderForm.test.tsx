import { afterEach, beforeEach, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $findView, setFindView } from '../../../src/app/store/find-view'
import { $query, setQuery } from '../../../src/app/store/query'
import { FinderForm } from '../../../src/features/find'
import { $analysis } from '../../../src/features/find/run'
import { toSimple } from '../../../src/features/find/simple'
import {
  defaultQueryState,
  fromQueryJson,
} from '../../../src/features/query/query'
import { initialCoordinatorState } from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'

let root: Root | undefined
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  searchStore.setState(() => initialCoordinatorState())
  setQuery(defaultQueryState())
  container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(
      <TooltipProvider>
        <FinderForm />
      </TooltipProvider>
    )
  })
})

afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
  searchStore.setState(() => initialCoordinatorState())
  $analysis.set(undefined)
  setFindView('simple')
  localStorage.clear()
})

const button = (name: string) =>
  [...container.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === name
  )
const select = (label: string) =>
  container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)
function choose(label: string, value: string) {
  const element = select(label)
  if (!element) throw new Error(`no select ${label}`)
  act(() => {
    element.value = value
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

it('asks for a first item and keeps Find disabled until then', () => {
  expect(container.textContent).toContain('Add at least one requirement.')
  expect(button('Find')?.disabled).toBe(true)
  act(() => button('Add item')?.click())
  expect(select('Item 1 name')?.value).toBe('ring_wealth')
  expect(container.textContent).not.toContain('Add at least one requirement.')
})

it('writes row edits to the saved query', () => {
  act(() => button('Add item')?.click())
  choose('Item 1 category', 'wand')
  choose('Item 1 name', 'wand_frost')
  choose('Item 1 upgrade level', '2')
  choose('Item 1 floor', '9')
  expect(toSimple($query.get())?.constraints).toEqual([
    expect.objectContaining({
      kind: 'wand',
      item: 'wand_frost',
      minUpgrade: 2,
    }),
  ])
  expect($query.get().maxDepth).toBe(9)
  expect(container.textContent).toContain('↑9')
})

it('explains an impossible query and blocks Find', () => {
  act(() => button('Add item')?.click())
  act(() =>
    $analysis.set({
      valid: true,
      impossible: true,
      probability: null,
      notes: ['Requirement 1 needs floor 17 or later, beyond its floor limit.'],
    })
  )
  const alert = container.querySelector('[role="alert"]')
  expect(alert?.textContent).toContain('Impossible query')
  expect(alert?.textContent).toContain('needs floor 17 or later')
  expect(button('Find')?.disabled).toBe(true)
})

it('shows the match probability of a possible query', () => {
  act(() => button('Add item')?.click())
  act(() =>
    $analysis.set({
      valid: true,
      impossible: false,
      probability: 0.001,
      notes: [],
    })
  )
  expect(container.textContent).toContain('Match probability ≈ 1 in 1 K')
  expect(button('Find')?.disabled).toBe(false)
})

it('shows an Advanced query as a notice that can clear it', () => {
  act(() => setQuery({ ...defaultQueryState(), requireBlacksmith: true }))
  expect(container.textContent).toContain('Advanced query active')
  expect(select('Item 1 name')).toBeNull()
  act(() => button('Clear')?.click())
  expect($query.get()).toEqual(defaultQueryState())
})

it('opens an Advanced query in the Advanced view, which shows all of it', () => {
  act(() =>
    setQuery(
      fromQueryJson(
        '{"requirements":[{"kind":"weapon","effect":"Blazing"}],"auto_apply_trinket":true}'
      )
    )
  )
  expect(container.textContent).toContain('Advanced query active')
  act(() => button('Edit in Advanced')?.click())
  expect($findView.get()).toBe('advanced')
  expect(container.textContent).not.toContain('Advanced query active')
  expect(container.querySelector('[data-slot="chip-name"]')?.textContent).toBe(
    'Any weapon'
  )
  expect(container.textContent).toContain('1 requirement')
  // Find stays, and the match rule is Simple's alone.
  expect(button('Find')).toBeDefined()
  expect(container.querySelector('#finder-match-rule')).toBeNull()
})

it('locks the rows and offers Cancel while a search runs', () => {
  act(() => button('Add item')?.click())
  act(() => searchStore.setState((state) => ({ ...state, state: 'running' })))
  expect(button('Cancel')).toBeDefined()
  expect(button('Find')).toBeUndefined()
  expect(select('Item 1 name')?.disabled).toBe(true)
  expect(button('Add item')?.disabled).toBe(true)
  act(() => searchStore.setState((state) => ({ ...state, state: 'stopping' })))
  expect(button('Cancelling…')?.disabled).toBe(true)
})
