import { CaretDownIcon } from '@phosphor-icons/react'
import {
  Combobox,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '@seed-seeker/design/ui/combobox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@seed-seeker/design/ui/popover'
import { type ReactNode, useState } from 'react'

/** One choice of a picker; `value` is unique across all its groups. */
export interface PickerEntry {
  value: string
  label: string
}

/** Choices under one heading; an empty heading draws none. */
export interface PickerGroup<T extends PickerEntry> {
  value: string
  items: T[]
}

const TRIGGER_CLASS =
  'border-input bg-background inset-shadow-recessed focus-visible:border-ring focus-visible:ring-ring/40 flex h-9 w-full min-w-0 items-center gap-2 rounded-sm border pr-2 pl-2 text-left text-sm outline-none focus-visible:ring-2 disabled:opacity-50'

const sameEntry = (a: PickerEntry, b: PickerEntry) => a.value === b.value

/**
 * A searchable, grouped list behind a trigger. The popover is modal so it
 * stacks over the sheet's dialog and scrolls under its scroll lock; the
 * groups are built on opening.
 */
export function GroupedPicker<T extends PickerEntry>({
  label,
  face,
  groups,
  value,
  icon,
  searchPlaceholder,
  emptyText,
  keepOpen,
  onPick,
}: {
  /** The trigger's and the search field's accessible name. */
  label: string
  /** What the closed trigger shows. */
  face: ReactNode
  groups: () => PickerGroup<T>[]
  /** The checked entries: one, several, or none. */
  value: (groups: PickerGroup<T>[]) => T | T[] | null
  icon?: (entry: T) => ReactNode
  searchPlaceholder: string
  emptyText: string
  /** Entries that toggle in place, leaving the list open for more. */
  keepOpen?: (entry: T) => boolean
  /** The entry the user checked or unchecked. */
  onPick: (entry: T) => void
}) {
  // The groups of the open list; `null` while closed.
  const [items, setItems] = useState<PickerGroup<T>[] | null>(null)
  const open = items !== null
  const setOpen = (next: boolean) => setItems(next ? groups() : null)
  const checked = items
    ? [value(items)].flat().filter((entry): entry is T => entry !== null)
    : []
  const has = (list: T[], entry: T) =>
    list.some((other) => sameEntry(other, entry))
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={TRIGGER_CLASS}
        >
          {face}
          <CaretDownIcon className="text-muted-foreground size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(22rem,var(--radix-popover-content-available-width))] gap-0 overflow-hidden p-0"
      >
        {items ? (
          <Combobox<T, true>
            multiple
            items={items}
            value={checked}
            isItemEqualToValue={sameEntry}
            onValueChange={(next) => {
              const toggled =
                next.find((entry) => !has(checked, entry)) ??
                checked.find((entry) => !has(next, entry))
              if (toggled) onPick(toggled)
              if (!toggled || !keepOpen?.(toggled)) setOpen(false)
            }}
            inline
            open
          >
            <div className="flex flex-col *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8">
              <ComboboxInput
                showTrigger={false}
                placeholder={searchPlaceholder}
                aria-label={`Search ${label.toLowerCase()}`}
              />
              <ComboboxEmpty className="flex empty:hidden">
                {emptyText}
              </ComboboxEmpty>
              <ComboboxList className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-3rem))] px-1 pb-1">
                {(group: PickerGroup<T>) => (
                  <ComboboxGroup key={group.value} items={group.items}>
                    {group.value ? (
                      <ComboboxLabel className="bg-popover sticky top-0 z-10 py-1.5 text-xs font-semibold">
                        {group.value}
                      </ComboboxLabel>
                    ) : null}
                    <ComboboxCollection>
                      {(entry: T) => (
                        <ComboboxItem
                          key={entry.value}
                          value={entry}
                          className="py-1"
                        >
                          {icon?.(entry)}
                          {entry.label}
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxGroup>
                )}
              </ComboboxList>
            </div>
          </Combobox>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
