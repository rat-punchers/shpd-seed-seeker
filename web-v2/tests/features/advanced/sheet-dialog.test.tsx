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

/** Moves a range input to option `index`, as a drag of its thumb does. */
async function slide(input: HTMLInputElement, index: number) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set?.call(input, String(index))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
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
  const floors = inSheet('input[type="range"]') as HTMLInputElement
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
  await click('Specific…')
  expect(sheet()?.textContent).toContain('Tick the effects the item may carry')
  const glyph = inSheet('[aria-label="Effects"] [role="switch"]')
  await act(async () => glyph.click())
  expect(sheet()?.textContent).toContain('Matches any one of 1 effect.')
  await act(async () => glyph.click())
  await click('Any', inSheet('[aria-label="Glyph filter"]'))
  expect(sheet()?.querySelector('[aria-label="Effects"]')).toBeNull()
  await click('Save Changes')
  expect($query.get()).toBe(state)
})

it('shows why a draft cannot be saved and keeps its button off', async () => {
  await render('{"requirements":[{"item":"rat_skull"}]}')
  await click('Add')
  await click('Trinket')
  const item = inSheet('select') as HTMLSelectElement
  await act(async () => {
    item.value = 'rat_skull'
    item.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(inSheet('[role="alert"]').textContent).toBe(
    'This trinket is already required. Each trinket appears only once in the deck.'
  )
  expect(button('Add Requirement', sheet() ?? document)?.disabled).toBe(true)
})

it('adds an enchanted weapon through the sheet, and Cancel leaves the query', async () => {
  await render('{"requirements":[]}')
  await click('Add')
  expect(inSheet('h2').textContent).toBe('New Requirement')
  await click('Cancel', sheet() ?? document)
  expect(sheet()).toBeNull()
  expect(requirements()).toEqual([])

  await click('Add')
  await click('Specific…')
  const blazing = [
    ...(sheet()?.querySelectorAll<HTMLLabelElement>(
      '[aria-label="Effects"] label'
    ) ?? []),
  ].find((label) => label.textContent === 'Blazing')
  await act(async () =>
    blazing?.querySelector<HTMLElement>('[role="switch"]')?.click()
  )
  await click('Add Requirement', sheet() ?? document)
  expect(requirements()).toEqual([{ kind: 'weapon', effect: 'Blazing' }])
  expect(chip('Any weapon').getAttribute('aria-label')).toContain('Blazing')
})
