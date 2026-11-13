import { expect, it } from 'bun:test'
import { act } from 'react'
import { $query } from '../../../src/app/store/query'
import {
  button,
  chip,
  click,
  installBoardHarness,
  press,
  render,
  requirements,
} from './board-harness'

installBoardHarness()

const sheet = () =>
  document.querySelector<HTMLElement>('[data-slot="requirement-sheet"]')

function inSheet(selector: string): HTMLElement {
  const found = sheet()?.querySelector<HTMLElement>(selector)
  expect(found ?? undefined).toBeDefined()
  return found as HTMLElement
}

/** Flips the switch the sheet labels `name`. */
async function toggle(name: string) {
  const label = [
    ...(sheet()?.querySelectorAll<HTMLLabelElement>('label') ?? []),
  ].find((element) => element.textContent?.trim() === name)
  expect(label).toBeDefined()
  const control = document.getElementById(label?.htmlFor ?? '')
  await act(async () => control?.click())
}

/** Moves a slider's thumb to option `index` from the keyboard, one key at a time. */
async function slide(thumb: HTMLElement, index: number) {
  const key = (name: string) =>
    act(async () => {
      thumb.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true })
      )
    })
  await key('Home')
  for (let step = 0; step < index; step++) await key('ArrowRight')
}

/** Opens or closes the sheet's picker named `name`. */
async function togglePicker(name: string) {
  const trigger = inSheet(`[role="combobox"][aria-label="${name}"]`)
  await act(async () => trigger.click())
}

const entries = () => [
  ...document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]'),
]

/** Checks or unchecks the open picker's entry labelled `label`. */
async function choose(label: string) {
  const entry = entries().find(
    (element) => element.textContent?.trim() === label
  )
  expect(entry ?? undefined).toBeDefined()
  await act(async () => entry?.click())
}

/** Opens the sheet's picker named `name` and picks the entry labelled `label`. */
async function pick(name: string, label: string) {
  await togglePicker(name)
  await choose(label)
}

it("draws the core's form and saves a stack with its copies' floor", async () => {
  await render('{"requirements":[{"kind":"weapon","item":"spear"}]}')
  await press(chip('Spear'), 'Enter')
  expect(inSheet('h2').textContent).toBe('Edit Requirement')
  expect(inSheet('[data-slot="sheet-subject"]').textContent).toBe('Spear')
  // A named weapon has no tier filter.
  expect(sheet()?.querySelector('[aria-label="Tier predicate"]')).toBeNull()
  // The count stepper takes the stack section's label.
  await click('One more', inSheet('[aria-label="Total item count"]'))
  expect(inSheet('[data-slot="stepper-value"]').textContent).toBe('×2')
  await toggle('Limit the extra copies to a floor')
  expect(sheet()?.textContent).toContain('Copies within first 4 floors')
  // The slider's name stays put while its reading moves.
  const floors = inSheet('[role="slider"]')
  expect(floors.getAttribute('aria-label')).toBe('Copies within first')
  await slide(floors, 4)
  expect(sheet()?.textContent).toContain('Copies within first 6 floors')
  expect(floors.getAttribute('aria-label')).toBe('Copies within first')
  expect(floors.getAttribute('aria-valuetext')).toBe('6')
  await click('Save Changes')
  expect(sheet()).toBeNull()
  expect(requirements()).toEqual([
    { kind: 'weapon', item: 'spear' },
    { kind: 'weapon', item: 'spear', max_depth: 6 },
  ])
})

it('ticks effects through the core and keeps an unchanged save from touching the query', async () => {
  await render('{"requirements":[{"kind":"armor"}]}')
  const state = $query.get()
  await press(chip('Any armor'), 'Enter')
  await togglePicker('Glyph')
  // The modes but "Specific…" come first, then the glyphs and curses.
  const labels = entries().map((entry) => entry.textContent?.trim())
  expect(labels.slice(0, 2)).toEqual(['Any', 'Any glyph'])
  expect(labels).not.toContain('Specific…')
  const first = labels[2] ?? ''
  const second = labels[3] ?? ''
  // Effects tick in place, the list staying open for more.
  await choose(first)
  await choose(second)
  expect(sheet()?.textContent).toContain('Matches any one of 2 effects.')
  expect(inSheet('[aria-label="Glyph"]').textContent).toBe(
    `${first}, ${second}`
  )
  await choose(second)
  expect(sheet()?.textContent).toContain('Matches any one of 1 effect.')
  // Unticking the last one returns to Any.
  await choose(first)
  expect(inSheet('[aria-label="Glyph"]').textContent).toBe('Any')
  expect(sheet()?.textContent).not.toContain('Matches any one')
  await togglePicker('Glyph')
  await click('Save Changes')
  expect($query.get()).toBe(state)
})

it('shows why a draft cannot be saved and keeps its button off', async () => {
  await render('{"requirements":[{"item":"rat_skull"}]}')
  await click('Add')
  await pick('Item', 'Rat Skull')
  expect(inSheet('[data-slot="sheet-subject"]').textContent).toBe('Rat Skull')
  expect(inSheet('[role="alert"]').textContent).toBe(
    'This trinket is already required. Each trinket appears only once in the deck.'
  )
  expect(button('Add Requirement', sheet() ?? document)?.disabled).toBe(true)
})

it('picks the kind and source from searchable lists, and keeps a named weapon general', async () => {
  await render('{"requirements":[]}')
  await click('Add')
  await pick('Item', 'Any thrown weapon')
  expect(inSheet('[aria-label="Item"]').textContent).toContain(
    'Any thrown weapon'
  )
  await pick('Source', 'Locked chest')
  expect(inSheet('[aria-label="Source"]').textContent).toContain('Locked chest')
  await click('Add Requirement', sheet() ?? document)
  expect(requirements()).toEqual([
    { kind: 'thrown_weapon', source: 'locked_chest' },
  ])

  await click('Add')
  await pick('Item', 'Spear')
  await click('Add Requirement', sheet() ?? document)
  expect(requirements().at(-1)).toEqual({ kind: 'weapon', item: 'spear' })
})

it('adds an enchanted weapon through the sheet, and Cancel leaves the query', async () => {
  await render('{"requirements":[]}')
  await click('Add')
  expect(inSheet('h2').textContent).toBe('New Requirement')
  await click('Cancel', sheet() ?? document)
  expect(sheet()).toBeNull()
  expect(requirements()).toEqual([])

  await click('Add')
  await pick('Enchantment', 'Blazing')
  await togglePicker('Enchantment')
  await click('Add Requirement', sheet() ?? document)
  expect(requirements()).toEqual([{ kind: 'weapon', effect: 'Blazing' }])
  expect(chip('Any weapon').getAttribute('aria-label')).toContain('Blazing')
})
