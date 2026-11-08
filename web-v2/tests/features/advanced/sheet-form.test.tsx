import { expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type {
  EditorChange,
  EditorForm,
  EditorSheet,
} from '../../../src/engine/types'
import { SheetBody } from '../../../src/features/advanced/sheet/RequirementEditor'
import { defaultQueryState } from '../../../src/features/query/query'
import {
  changeSheet,
  openSheet,
} from '../../../src/features/query/requirements/sheet'

/** A sheet the core opened on a new chip, then moved by `changes`. */
function sheetAfter(...changes: EditorChange[]): EditorSheet {
  let answer = openSheet(defaultQueryState(), { type: 'new', blanket: false })
  for (const change of changes)
    if (answer.ok) answer = changeSheet(answer.value, change)
  if (!answer.ok) throw new Error(answer.error)
  return answer.value
}

/** The form a sheet draws, as a detached DOM tree. */
function drawn(sheet: EditorSheet): HTMLElement {
  const element = document.createElement('div')
  element.innerHTML = renderToStaticMarkup(
    <SheetBody sheet={sheet} onChange={() => {}} />
  )
  return element
}

const withForm = (sheet: EditorSheet, patch: Partial<EditorForm>) =>
  drawn({ ...sheet, form: { ...sheet.form, ...patch } })

const has = (element: HTMLElement, selector: string) =>
  element.querySelector(selector) !== null

const captions = (element: HTMLElement) =>
  [...element.querySelectorAll('[data-slot="caption"]')].map(
    (caption) => caption.textContent
  )

const labels = (element: HTMLElement) =>
  [...element.querySelectorAll('[data-slot="control-label"]')].map(
    (label) => label.textContent
  )

it('draws a control only while the form shows it, with any caption it carries', () => {
  const open = sheetAfter()
  const { form } = open
  expect(has(withForm(open, {}), '[aria-label="Item"]')).toBe(true)
  expect(withForm(open, {}).textContent).toContain('Any weapon')
  expect(
    has(
      withForm(open, { item: { ...form.item, visible: false } }),
      '[aria-label="Item"]'
    )
  ).toBe(false)
  expect(has(withForm(open, {}), '[aria-label="Source"]')).toBe(true)
  expect(
    has(
      withForm(open, { source: { ...form.source, visible: false } }),
      '[aria-label="Source"]'
    )
  ).toBe(false)
  // The floor limit alone still gets its Details section.
  const floorOnly = withForm(open, {
    effect: { ...form.effect, visible: false },
    uncursed: { ...form.uncursed, visible: false },
    source: { ...form.source, visible: false },
  })
  expect(floorOnly.textContent).toContain('Details')
  expect(floorOnly.textContent).toContain('Limit this item to a floor')
  const counting = {
    ...form.stack,
    count_levels: {
      ...form.stack.count_levels,
      visible: true,
      enabled: false,
      caption: 'Levels count once per ring.',
      caption_visible: true,
    },
  }
  expect(captions(withForm(open, { stack: counting }))).toContain(
    'Levels count once per ring.'
  )
  expect(
    captions(
      withForm(open, {
        stack: {
          ...counting,
          count_levels: { ...counting.count_levels, caption_visible: false },
        },
      })
    )
  ).not.toContain('Levels count once per ring.')
})

it("shows a slider, the effect grid and a caption on the core's flags, not on their modes", () => {
  const armor = sheetAfter({ type: 'set_category', value: 'armor' })
  const { form } = armor
  const html = (patch: Partial<EditorForm>, selector: string) =>
    has(withForm(armor, patch), selector)
  expect(html({}, '[aria-label="Minimum tier"]')).toBe(false)
  const tier = (value_visible: boolean) => ({
    tier: { ...form.tier, mode: 'at_least' as const, value_visible },
  })
  expect(html(tier(false), '[aria-label="Minimum tier"]')).toBe(false)
  expect(html(tier(true), '[aria-label="Minimum tier"]')).toBe(true)
  const upgrade = (value_visible: boolean) => ({
    upgrade: { ...form.upgrade, mode: 'exact' as const, value_visible },
  })
  expect(html(upgrade(false), '[aria-label="Exactly"]')).toBe(false)
  expect(html(upgrade(true), '[aria-label="Exactly"]')).toBe(true)
  expect(
    html(
      {
        effect: {
          ...form.effect,
          mode: 'specific',
          choices_visible: false,
        },
      },
      '[aria-label="Effects"]'
    )
  ).toBe(false)
  expect(
    html(
      { effect: { ...form.effect, choices_visible: true } },
      '[aria-label="Effects"]'
    )
  ).toBe(true)
  const limited = {
    ...form.transmutations,
    visible: true,
    enabled: true,
    caption: 'Up to one.',
  }
  expect(
    captions(
      withForm(armor, {
        transmutations: { ...limited, caption_visible: false },
      })
    )
  ).not.toContain('Up to one.')
  expect(
    captions(
      withForm(armor, { transmutations: { ...limited, caption_visible: true } })
    )
  ).toContain('Up to one.')
})

it("labels the sections and switches and shows their help texts in the core's words", () => {
  // Armor: the effect section is the Glyph.
  const armor = sheetAfter({ type: 'set_category', value: 'armor' })
  expect(armor.form.effect.label).toBe('Glyph')
  expect(labels(drawn(armor))).toContain('Glyph')
  expect(has(drawn(armor), '[aria-label="Glyph filter"]')).toBe(true)

  // An ordinary wand: resin exclusion, with its help under it.
  const wand = sheetAfter({ type: 'set_category', value: 'wand' })
  expect(wand.form.exclude_resin.caption).not.toBeNull()
  expect(captions(drawn(wand))).toContain(
    String(wand.form.exclude_resin.caption)
  )

  // A trinket: the choice at +3, with its help under it.
  const trinket = sheetAfter({ type: 'set_category', value: 'trinket' })
  expect(captions(drawn(trinket))).toContain(
    String(trinket.form.select_trinket.caption)
  )

  // A ring stack: the combined level's help shows beside its switch, on or off.
  const stack = sheetAfter(
    { type: 'set_category', value: 'ring' },
    { type: 'set_item', value: 'ring_might' },
    { type: 'set_count', value: 2 }
  )
  const { count_levels } = stack.form.stack
  expect(count_levels).toMatchObject({
    visible: true,
    enabled: false,
    caption_visible: true,
  })
  expect(captions(drawn(stack))).toContain(String(count_levels.caption))
  const headings = [...drawn(stack).querySelectorAll('h3')].map(
    (heading) => heading.textContent
  )
  expect(headings).toContain(stack.form.stack.label)

  // The transmutation limit's help shows only while the limit is on.
  const limited = sheetAfter(
    { type: 'set_category', value: 'trinket' },
    { type: 'set_transmutations_enabled', value: true }
  )
  expect(limited.form.transmutations.caption_visible).toBe(true)
  const caption = limited.form.transmutations.caption
  expect(captions(drawn(limited))).toContain(String(caption))
  expect(captions(drawn(trinket))).not.toContain(String(caption))
})

it('words the resin section, its choice, bounds and Mage switch as the core does', () => {
  const amount = sheetAfter(
    { type: 'set_category', value: 'wand' },
    { type: 'set_item', value: 'arcane_resin' }
  )
  const { resin } = amount.form
  const element = drawn(amount)
  expect(labels(element)).toContain(resin.label)
  const modes = [
    ...element.querySelectorAll('[aria-label="Resin amount mode"] button'),
  ].map((mode) => mode.textContent)
  expect(modes).toEqual(resin.modes.map((mode) => mode.label))
  const field = element.querySelector<HTMLInputElement>('input[type="number"]')
  expect(field?.getAttribute('aria-label')).toBe(resin.label)
  expect(field?.getAttribute('min')).toBe(String(resin.min))
  expect(field?.getAttribute('max')).toBe(String(resin.max))
  expect(field?.getAttribute('value')).toBe(String(resin.amount))
  expect(captions(element)).not.toContain(resin.caption)
  expect(element.textContent).toContain(resin.include_mage_wand.label)
  expect(captions(element)).toContain(String(resin.include_mage_wand.caption))

  const auto = sheetAfter(
    { type: 'set_category', value: 'wand' },
    { type: 'set_item', value: 'arcane_resin' },
    { type: 'set_resin_auto', value: true }
  )
  // Auto's meaning shows in the amount field's place.
  expect(captions(drawn(auto))).toContain(auto.form.resin.caption)
  expect(has(drawn(auto), 'input[type="number"]')).toBe(false)
})
