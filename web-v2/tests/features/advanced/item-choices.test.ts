import { expect, it } from 'bun:test'
import type { EditorChange, EditorSheet } from '../../../src/engine/types'
import {
  currentItem,
  itemGroups,
} from '../../../src/features/advanced/sheet/item-choices'
import { sourceGroups } from '../../../src/features/advanced/sheet/source-choices'
import { defaultQueryState } from '../../../src/features/query/query'
import {
  changeSheet,
  openSheet,
} from '../../../src/features/query/requirements/sheet'

function sheetAfter(...changes: EditorChange[]): EditorSheet {
  let answer = openSheet(defaultQueryState(), { type: 'new', blanket: false })
  for (const change of changes)
    if (answer.ok) answer = changeSheet(answer.value, change)
  if (!answer.ok) throw new Error(answer.error)
  return answer.value
}

it("lists the chosen family's items under the core's tier headings", () => {
  const sheet = sheetAfter()
  expect(sheet.form.category.visible).toBe(true)
  expect(sheet.form.category.options.map((option) => option.value)).toEqual([
    'weapon',
    'armor',
    'wand',
    'ring',
    'trinket',
    'artifact',
  ])
  const groups = itemGroups(sheet.form)
  expect(groups[0]).toEqual({
    value: '',
    items: [{ value: 'any', label: 'Any weapon', item: null }],
  })
  expect(groups.map((group) => group.value)).toEqual([
    '',
    'Tier 2',
    'Tier 3',
    'Tier 4',
    'Tier 5',
  ])
  expect(currentItem(groups, sheet.form)?.label).toBe('Any weapon')
})

it('switches the list with the category tab and the weapon type', () => {
  const thrown = itemGroups(
    sheetAfter({ type: 'set_weapon_type', value: 'thrown' }).form
  ).flatMap((group) => group.items)
  expect(thrown[0]?.label).toBe('Any thrown weapon')
  expect(thrown.map((entry) => entry.item)).toContain('shuriken')
  expect(thrown.map((entry) => entry.item)).not.toContain('spear')

  const artifacts = sheetAfter({ type: 'set_category', value: 'artifact' })
  const names = itemGroups(artifacts.form).flatMap((group) => group.items)
  expect(names.map((entry) => entry.item)).toContain('skeleton_key')
  // Artifacts are named, never "any": the sheet starts on the first.
  expect(names.some((entry) => entry.item === null)).toBe(false)
  expect(currentItem(itemGroups(artifacts.form), artifacts.form)?.item).toBe(
    artifacts.form.item.value
  )

  const wands = itemGroups(
    sheetAfter({ type: 'set_category', value: 'wand' }).form
  ).flatMap((group) => group.items)
  expect(wands.slice(0, 2).map((entry) => entry.item)).toEqual([
    null,
    'arcane_resin',
  ])
})

it('groups the sources under headings, Any first and unheaded', () => {
  const { form } = sheetAfter()
  const groups = sourceGroups(form.source.options)
  expect(groups[0]).toEqual({
    value: '',
    items: [{ value: 'any', label: 'Any', source: null }],
  })
  expect(groups.map((group) => group.value)).toEqual([
    '',
    'Floor',
    'Chests',
    'Mimics',
    'Statues',
    'Shops and quests',
  ])
  expect(groups.flatMap((group) => group.items)).toHaveLength(
    form.source.options.length
  )
})
