import { afterEach, beforeEach, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  $query,
  $workerCount,
  setQuery,
  setWorkerCount,
} from '../../../src/app/store/query'
import { AdvancedQuery } from '../../../src/features/advanced'
import { challengeEffect } from '../../../src/features/advanced/settings/Challenges'
import {
  defaultQueryState,
  fromQueryJson,
} from '../../../src/features/query/query'

let root: Root | undefined
let container: HTMLDivElement
const cores = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  'hardwareConcurrency'
)

function stubCores(count: number) {
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    configurable: true,
    get: () => count,
  })
}

async function render(document?: string) {
  setQuery(document ? fromQueryJson(document) : defaultQueryState())
  container = window.document.createElement('div')
  window.document.body.append(container)
  await act(async () => {
    root = createRoot(container)
    root.render(
      <TooltipProvider>
        <AdvancedQuery />
      </TooltipProvider>
    )
  })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  stubCores(8)
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
  setQuery(defaultQueryState())
  // The instance property shadows the prototype's getter; drop it.
  Reflect.deleteProperty(navigator, 'hardwareConcurrency')
  if (cores)
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', cores)
  localStorage.clear()
})

const section = (name: string) =>
  container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)
const summaryText = (name: string) =>
  section(name)?.querySelector('summary')?.textContent
const scope = () =>
  container.querySelector<HTMLElement>(
    'section[aria-labelledby="search-scope-heading"]'
  )
const control = (label: string) => {
  const element = [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim() === label
  )
  return window.document.getElementById(element?.htmlFor ?? '')
}
const buttonNamed = (name: string) =>
  [...container.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === name
  )
const click = (element: Element | null | undefined) =>
  act(async () => (element as HTMLElement | undefined)?.click())

async function slide(input: HTMLInputElement, index: number) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set?.call(input, String(index))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('lays the settings out below the boards, collapsed after Search scope', async () => {
  await render()
  const settings = container.querySelector('[data-testid="advanced-settings"]')
  const titles = [...(settings?.children ?? [])].map((element) =>
    element.tagName === 'SECTION'
      ? (element.getAttribute('aria-label') ??
        element.querySelector('h3')?.textContent)
      : null
  )
  expect(titles).toEqual([
    'Search scope',
    'Wandmaker',
    'Blacksmith',
    'Rooms and feelings',
    'Performance',
    'Challenges',
  ])
  for (const name of titles.slice(1))
    expect(
      section(name as string)?.querySelector('details')?.open ?? null
    ).toBe(false)
  // The Requirements board holds no setting.
  expect(
    section('Requirements')?.querySelector('[data-farming-floors]')
  ).toBeNull()
})

it('moves the floor limit across the selector floors only', async () => {
  await render()
  const slider = scope()?.querySelector<HTMLInputElement>(
    'input[type="range"]'
  ) as HTMLInputElement
  expect(slider.getAttribute('aria-label')).toBe('Floor limit')
  expect(scope()?.textContent).toContain('first 24 floors')
  // Option 4 is floor 6: the empty boss floor 5 is not offered.
  await slide(slider, 4)
  expect($query.get().maxDepth).toBe(6)
  expect(scope()?.textContent).toContain('first 6 floors')
  await slide(slider, 0)
  expect(scope()?.textContent).toContain('first 1 floor')
})

it('shows AutoTrinket on and defers only to an explicit trinket selection', async () => {
  await render()
  const autoTrinket = () => control('AutoTrinket')
  expect(autoTrinket()?.getAttribute('aria-checked')).toBe('true')
  await click(autoTrinket())
  expect($query.get().autoApplyTrinket).toBe(false)
  await click(autoTrinket())
  expect($query.get().autoApplyTrinket).toBe(true)
  await act(async () =>
    setQuery(
      fromQueryJson(
        '{"auto_apply_trinket":true,"requirements":[{"any_of":[{"item":"rat_skull"},{"item":"mimic_tooth"}]}]}'
      )
    )
  )
  expect(autoTrinket()?.hasAttribute('disabled')).toBe(false)
  await act(async () =>
    setQuery(
      fromQueryJson(
        '{"auto_apply_trinket":true,"requirements":[{"item":"rat_skull","select_trinket":true}]}'
      )
    )
  )
  expect(autoTrinket()?.hasAttribute('disabled')).toBe(true)
  expect(autoTrinket()?.getAttribute('aria-checked')).toBe('true')
  expect(scope()?.textContent).toContain(
    'Uses your explicit trinket selection instead.'
  )
})

it('picks the Wandmaker quest and counts it', async () => {
  await render()
  const select = section('Wandmaker')?.querySelector('select')
  expect([...(select?.options ?? [])].map((option) => option.text)).toEqual([
    'Any',
    'Corpse Dust',
    'Elemental Embers',
    'Rotberry',
  ])
  await act(async () => {
    if (!select) return
    select.value = 'rotberry'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect($query.get().wandmakerQuest).toBe('rotberry')
  expect(summaryText('Wandmaker')).toBe('Wandmaker1')
  await act(async () => {
    if (!select) return
    select.value = ''
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect($query.get().wandmakerQuest).toBeUndefined()
})

it('requires the Blacksmith only below his last floor, and excludes his rewards', async () => {
  await render('{"max_depth":24,"requirements":[]}')
  expect(
    control('Require accessible blacksmith')?.hasAttribute('disabled')
  ).toBe(true)
  await act(async () => setQuery({ ...$query.get(), maxDepth: 9 }))
  await click(control('Require accessible blacksmith'))
  await click(control('Exclude Smith rewards'))
  expect($query.get()).toMatchObject({
    requireBlacksmith: true,
    excludeBlacksmithRewards: true,
  })
  expect(summaryText('Blacksmith')).toBe('Blacksmith2')
})

it('toggles the three farming floors, and lists and removes other floor requirements', async () => {
  await render(
    '{"max_depth":9,"floor_requirements":[{"depth":3,"feeling":"water","rooms":["shop"]}],"requirements":[]}'
  )
  const farming = section('Rooms and feelings')?.querySelector(
    '[data-farming-floors]'
  )
  expect(farming?.querySelector('legend')?.textContent).toContain(
    'Ring of Wealth farming floors'
  )
  expect(
    farming?.querySelector('[aria-label="About Ring of Wealth farming floors"]')
      ?.tagName
  ).toBe('BUTTON')
  const floor17 = () => buttonNamed('Floor 17')
  expect(
    [...(farming?.querySelectorAll('[data-slot="toggle"]') ?? [])].map(
      (element) => element.textContent
    )
  ).toEqual(['Floor 7', 'Floor 17', 'Floor 22'])
  await click(floor17())
  expect(floor17()?.getAttribute('aria-pressed')).toBe('true')
  expect($query.get().floorRequirements).toEqual([
    { depth: 3, feeling: 'water', rooms: ['shop'] },
    { depth: 17, feeling: 'dark', any_rooms: ['garden', 'secret_garden'] },
  ])
  // A farming floor past the floor limit raises it.
  expect($query.get().maxDepth).toBe(17)
  expect(summaryText('Rooms and feelings')).toBe('Rooms and feelings2')
  const other = container.querySelector('[data-floor-requirement="3"]')
  expect(other?.textContent).toContain('water floor')
  expect(other?.textContent).toContain('shop')
  expect(container.querySelector('[data-floor-requirement="17"]')).toBeNull()
  await click(floor17())
  await click(
    container.querySelector('[aria-label="Remove floor 3 requirement"]')
  )
  expect($query.get().floorRequirements).toEqual([])
})

it('sets the worker count, and hides it on one core', async () => {
  setWorkerCount(8)
  await render()
  const workers = section('Performance')?.querySelector<HTMLInputElement>(
    'input[type="range"]'
  ) as HTMLInputElement
  expect(section('Performance')?.textContent).toContain('8 of 8 cores')
  await slide(workers, 2)
  expect($workerCount.get()).toBe(3)
  expect(section('Performance')?.textContent).toContain('3 of 8 cores')
  act(() => root?.unmount())
  setWorkerCount(8)
  stubCores(1)
  await render()
  expect(section('Performance')).toBeNull()
  expect(container.textContent).not.toContain('Workers')
})

it('toggles challenges and says what each changes', async () => {
  await render()
  await click(control('Barren Land'))
  await click(control('Badder Bosses'))
  expect($query.get().challenges).toEqual(['barren_land', 'badder_bosses'])
  expect(summaryText('Challenges')).toBe('Challenges2')
  await click(control('Barren Land'))
  expect($query.get().challenges).toEqual(['badder_bosses'])
  expect(challengeEffect('badder_bosses')).toBe('Changes boss layouts.')
  expect(challengeEffect('into_darkness')).toBe('Changes level generation.')
  expect(challengeEffect('on_diet')).toBe('No effect on seed content.')
  expect(section('Challenges')?.textContent).toContain(
    'No effect on seed content.'
  )
})
