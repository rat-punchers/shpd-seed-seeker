import { expect, it } from 'bun:test'
import type { EditorChange, EditorSheet } from '../../../src/engine/types'
import {
  currentItem,
  itemGroups,
  pickChanges,
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

it('lists the wildcards first, then every item once under its kind and tier', () => {
  const groups = itemGroups(sheetAfter())
  expect(groups[0]?.value).toBe('Any of a kind')
  expect(groups[0]?.items.map((entry) => entry.label)).toEqual([
    'Any weapon',
    'Any melee weapon',
    'Any thrown weapon',
    'Any armor',
    'Any wand',
    'Any ring',
  ])
  expect(groups.map((group) => group.value)).toContain('Melee weapons · Tier 2')
  expect(groups.map((group) => group.value)).toContain(
    'Thrown weapons · Tier 5'
  )
  expect(groups.map((group) => group.value)).toContain('Trinkets')
  // Named weapons sit under melee or thrown, never again under "Weapons".
  expect(groups.map((group) => group.value)).not.toContain('Weapons · Tier 2')
  const items = groups.flatMap((group) => group.items)
  const named = items.filter((entry) => entry.item !== null)
  expect(new Set(named.map((entry) => entry.item)).size).toBe(named.length)
  expect(items.map((entry) => entry.item)).toContain('rat_skull')
})

it('finds the current choice and sends only what a pick changes', () => {
  const sheet = sheetAfter()
  const groups = itemGroups(sheet)
  expect(currentItem(groups, sheet.form)?.label).toBe('Any weapon')
  const all = groups.flatMap((group) => group.items)
  const spear = all.find((entry) => entry.item === 'spear')
  const skull = all.find((entry) => entry.item === 'rat_skull')
  if (!spear || !skull) throw new Error('missing entries')
  // The weapon wildcard already offers the spear: the kind stays general.
  expect(pickChanges(sheet.form, spear)).toEqual([
    { type: 'set_item', value: 'spear' },
  ])
  expect(pickChanges(sheet.form, skull)).toEqual([
    { type: 'set_kind', value: 'trinket' },
    { type: 'set_item', value: 'rat_skull' },
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
