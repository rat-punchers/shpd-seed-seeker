import type { RequirementKind } from '../../engine/types'
import { defaultQueryState } from './query'
import { changeSheet, openSheet } from './requirements/sheet'

// The items a requirement can name come from the shared core's item picker
// (docs/requirement-editor.md), never from a list kept here: the Advanced
// sheet shows one family of them at a time, and Simple shows them all in one
// menu, so the two modes always offer the same items in the same order.

/** One choice of the item list: a named item, or any item of a kind. */
export interface ItemChoice {
  value: string
  label: string
  kind: RequirementKind
  item?: string
}

/** Choices under one heading (`Melee weapons · Tier 2`, `Artifacts`). */
export interface ItemChoiceGroup {
  value: string
  items: ItemChoice[]
}

/** The list of every kind's items, built once from the core. */
export interface ItemList {
  /** The requirement kinds, in the core's order. */
  kinds: RequirementKind[]
  /** The wildcards first, then each kind's items under its heading. */
  groups: ItemChoiceGroup[]
}

/** A heading for a kind's items; the core labels a kind in the singular. */
export const KIND_HEADINGS: Record<RequirementKind, string> = {
  weapon: 'Weapons',
  melee_weapon: 'Melee weapons',
  thrown_weapon: 'Thrown weapons',
  armor: 'Armor',
  wand: 'Wands',
  ring: 'Rings',
  trinket: 'Trinkets',
  artifact: 'Artifacts',
}

export const WILDCARD_GROUP = 'Any of a kind'

export const choiceValue = (kind: RequirementKind, item?: string): string =>
  `${kind}:${item ?? 'any'}`

/** Arcane Resin is a query condition the picker offers among the wands. */
const ARCANE_RESIN = 'arcane_resin'

function buildItemList(): ItemList | null {
  const opened = openSheet(defaultQueryState(), { type: 'new', blanket: false })
  if (!opened.ok) return null
  const sheet = opened.value
  const kinds = sheet.form.kind.options.map((option) => option.value)
  const wildcards: ItemChoice[] = []
  const groups = new Map<string, ItemChoice[]>()
  const seen = new Set<string>()
  // "Weapon" names no items of its own: they sit under melee and thrown, so
  // its pass comes last and keeps only what those lack.
  const passes = [
    ...kinds.filter((kind) => kind !== 'weapon'),
    ...kinds.filter((kind) => kind === 'weapon'),
  ]
  for (const kind of passes) {
    const answer = changeSheet(sheet, { type: 'set_kind', value: kind })
    if (!answer.ok) return null
    for (const option of answer.value.form.item.options) {
      if (option.hidden || option.value === ARCANE_RESIN) continue
      if (option.value === null) {
        wildcards.push({ value: choiceValue(kind), label: option.label, kind })
        continue
      }
      if (seen.has(option.value)) continue
      seen.add(option.value)
      const heading = option.group
        ? `${KIND_HEADINGS[kind]} · ${option.group}`
        : KIND_HEADINGS[kind]
      const entry = {
        value: choiceValue(kind, option.value),
        label: option.label,
        kind,
        item: option.value,
      }
      groups.set(heading, [...(groups.get(heading) ?? []), entry])
    }
  }
  wildcards.sort(
    (left, right) => kinds.indexOf(left.kind) - kinds.indexOf(right.kind)
  )
  return {
    kinds,
    groups: [
      { value: WILDCARD_GROUP, items: wildcards },
      ...[...groups].map(([value, items]) => ({ value, items })),
    ].filter((group) => group.items.length > 0),
  }
}

let built: ItemList | null = null

/**
 * Every item a requirement can name, as the core's picker offers them. The
 * requirement editor loads before the first render, so this is ready by the
 * time any view asks.
 */
export function itemList(): ItemList {
  built ??= buildItemList()
  if (!built) throw new Error('The requirement editor has no item list.')
  return built
}
