import type {
  EditorChange,
  EditorForm,
  EditorOption,
  EditorSheet,
  RequirementKind,
} from '../../../engine/types'
import { simpleKindLabel } from '../../find/simple-items'
import { changeSheet } from '../../query/requirements/sheet'
import type { PickerEntry, PickerGroup } from './GroupedPicker'

/** One choice of the sheet's item picker: an item of a kind, or the kind's wildcard. */
export interface ItemEntry extends PickerEntry {
  kind: RequirementKind
  /** An item's stable id, `null` for the wildcard, or `arcane_resin`. */
  item: string | null
}

const ANY_GROUP = 'Any of a kind'

const kindHeading = (kind: RequirementKind): string =>
  kind === 'weapon' ? 'Weapons' : simpleKindLabel(kind)

/**
 * The item options the core offers for `kind`: the form's own for its kind,
 * else the core's answer to switching the draft to it.
 */
function optionsFor(
  sheet: EditorSheet,
  kind: RequirementKind
): EditorOption<string | null>[] {
  if (kind === sheet.form.kind.value) return sheet.form.item.options
  const answer = changeSheet(sheet, { type: 'set_kind', value: kind })
  return answer.ok ? answer.value.form.item.options : []
}

/**
 * Every item the sheet can name, as one list: the wildcards first, then each
 * kind's items under the core's headings (`Melee weapons · Tier 3`).
 */
export function itemGroups(sheet: EditorSheet): PickerGroup<ItemEntry>[] {
  const kinds = sheet.form.kind.options.map((option) => option.value)
  const wildcards = new Map<RequirementKind, ItemEntry>()
  const groups = new Map<string, ItemEntry[]>()
  const seen = new Set<string>()
  // "Weapon" names no items of its own: they sit under melee and thrown, so
  // its pass comes last and keeps only what those lack.
  const passes = [
    ...kinds.filter((kind) => kind !== 'weapon'),
    ...kinds.filter((kind) => kind === 'weapon'),
  ]
  for (const kind of passes)
    for (const option of optionsFor(sheet, kind)) {
      const entry = {
        value: `${kind}:${option.value ?? 'any'}`,
        label: option.label,
        kind,
        item: option.value,
      }
      if (option.value === null) {
        wildcards.set(kind, entry)
        continue
      }
      if (seen.has(option.value)) continue
      seen.add(option.value)
      const heading = option.group
        ? `${kindHeading(kind)} · ${option.group}`
        : kindHeading(kind)
      groups.set(heading, [...(groups.get(heading) ?? []), entry])
    }
  return [
    {
      value: ANY_GROUP,
      items: kinds.flatMap((kind) => wildcards.get(kind) ?? []),
    },
    ...[...groups].map(([value, items]) => ({ value, items })),
  ].filter((group) => group.items.length > 0)
}

/** The entry the form names: its item, or its kind's wildcard. */
export function currentItem(
  groups: PickerGroup<ItemEntry>[],
  form: EditorForm
): ItemEntry | null {
  const item = form.item.value
  return (
    groups
      .flatMap((group) => group.items)
      .find((entry) =>
        item === null
          ? entry.item === null && entry.kind === form.kind.value
          : entry.item === item
      ) ?? null
  )
}

/** What picking `entry` sends: the item alone when the form's kind offers it, else the kind first. */
export function pickChanges(
  form: EditorForm,
  entry: ItemEntry
): EditorChange[] {
  const offered =
    entry.item !== null &&
    form.item.options.some((option) => option.value === entry.item)
  return offered
    ? [{ type: 'set_item', value: entry.item }]
    : [
        { type: 'set_kind', value: entry.kind },
        { type: 'set_item', value: entry.item },
      ]
}
