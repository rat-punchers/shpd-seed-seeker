import type { EditorForm } from '../../../engine/types'
import type { PickerEntry, PickerGroup } from './GroupedPicker'

// The sheet picks a family first (the core's `category` and `weapon_type`
// controls, drawn as tabs), then one of that family's items from the core's
// own item options: the list Simple shows all at once
// (`features/query/item-list.ts`).

/** One choice of the sheet's item picker: an item, the wildcard, or `arcane_resin`. */
export interface ItemEntry extends PickerEntry {
  /** An item's stable id, `null` for the wildcard, or `arcane_resin`. */
  item: string | null
}

/**
 * The form's item options under the core's headings (`Tier 3`); the wildcard
 * and Arcane Resin come first, under none. An option the core hides shows only
 * while it is the current one.
 */
export function itemGroups(form: EditorForm): PickerGroup<ItemEntry>[] {
  const groups = new Map<string, ItemEntry[]>()
  for (const option of form.item.options) {
    if (option.hidden && option.value !== form.item.value) continue
    const heading = option.group ?? ''
    groups.set(heading, [
      ...(groups.get(heading) ?? []),
      {
        value: option.value ?? 'any',
        label: option.label,
        item: option.value,
      },
    ])
  }
  return [...groups].map(([value, items]) => ({ value, items }))
}

/** The entry the form names: its item, or the wildcard. */
export const currentItem = (
  groups: PickerGroup<ItemEntry>[],
  form: EditorForm
): ItemEntry | null =>
  groups
    .flatMap((group) => group.items)
    .find((entry) => entry.item === form.item.value) ?? null
