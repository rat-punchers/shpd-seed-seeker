import { expect, it } from 'bun:test'
import type { EditorChange, EditorSheet } from '../../../src/engine/types'
import {
  checkedEffects,
  effectChanges,
  effectGroups,
  effectSummary,
} from '../../../src/features/advanced/sheet/effect-choices'
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

/** The sheet after sending what picking the entry labelled `label` sends. */
function picked(sheet: EditorSheet, label: string): EditorSheet {
  const entry = effectGroups(sheet.form)
    .flatMap((group) => group.items)
    .find((candidate) => candidate.label === label)
  if (!entry) throw new Error(`no entry ${label}`)
  let next = sheet
  for (const change of effectChanges(sheet.form, entry)) {
    const answer = changeSheet(next, change)
    if (!answer.ok) throw new Error(answer.error)
    next = answer.value
  }
  return next
}

it('lists the modes but "Specific…", then the effects under their headings', () => {
  const groups = effectGroups(sheetAfter().form)
  expect(groups.map((group) => group.value)).toEqual([
    '',
    'Enchantments',
    'Curses',
  ])
  expect(groups[0]?.items.map((entry) => entry.label)).toEqual([
    'Any',
    'Any enchantment',
  ])
  expect(groups[1]?.items.map((entry) => entry.label)).toContain('Blazing')
})

it('ticks into "Specific…", reads back the ticks, and returns to Any after the last', () => {
  const start = sheetAfter()
  expect(effectSummary(start.form)).toBe('Any')
  const one = picked(start, 'Blazing')
  expect(one.form.effect.mode).toBe('specific')
  const two = picked(one, 'Chilling')
  expect(effectSummary(two.form)).toBe('Blazing, Chilling')
  expect(
    checkedEffects(effectGroups(two.form), two.form).map((e) => e.label)
  ).toEqual(['Blazing', 'Chilling'])
  const back = picked(picked(two, 'Chilling'), 'Blazing')
  expect(back.form.effect.mode).toBe('any')
  expect(
    checkedEffects(effectGroups(back.form), back.form).map((e) => e.label)
  ).toEqual(['Any'])
  const all = picked(back, 'Any enchantment')
  expect(effectSummary(all.form)).toBe('Any enchantment')
})
