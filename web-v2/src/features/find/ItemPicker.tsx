import { CaretDownIcon } from '@phosphor-icons/react'
import { tierClass } from '@seed-seeker/design/spd/item-slot'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from '@seed-seeker/design/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@seed-seeker/design/ui/dialog'
import { cn } from '@seed-seeker/design/utils'
import { useState } from 'react'
import { itemArt } from '../../shared/sprites/sprites'
import { ItemSprite } from '../../shared/ui/ItemSprite'
import { useMediaQuery } from '../../shared/ui/use-media-query'
import { FLOOR_LIMIT_OPTIONS, nearestOptionIndex } from '../query/query'
import { RowLimits } from './RowLimits'
import type { SimpleConstraint } from './simple'
import { setRowChoice, setRowDepth, setRowUpgrade } from './simple-edit'
import {
  choiceFor,
  ITEM_CHOICE_GROUPS,
  type ItemChoice,
  type ItemChoiceGroup,
  rowSprite,
  upgradeLevels,
} from './simple-items'

/** Phones get the picker as a full-screen dialog instead of a dropdown. */
const PHONE_QUERY = '(max-width: 639px)'

const TRIGGER_CLASS =
  'border-input bg-background inset-shadow-recessed focus-visible:border-ring focus-visible:ring-ring/40 flex h-10 w-full min-w-0 items-center gap-2 rounded-sm border pr-2 pl-1 text-left text-sm outline-none focus-visible:ring-2 disabled:opacity-50'

const sameChoice = (a: ItemChoice, b: ItemChoice) => a.value === b.value

interface PickerProps {
  row: SimpleConstraint
  number: number
  depth: number
  disabled: boolean
}

/** What the closed picker shows: the item, its minimum upgrade and floor. */
function TriggerFace({ row, depth }: { row: SimpleConstraint; depth: number }) {
  return (
    <>
      <ItemSprite art={itemArt(rowSprite(row.kind, row.item))} size={32} />
      <span className="min-w-0 flex-1 truncate">
        {choiceFor(row.kind, row.item).label}
      </span>
      {row.minUpgrade !== undefined ? (
        <span className={`text-xs tabular-nums ${tierClass(row.minUpgrade)}`}>
          +{row.minUpgrade}
        </span>
      ) : null}
      <span className="text-muted-foreground text-xs tabular-nums">
        ↑{depth}
      </span>
    </>
  )
}

/** The menu: search, the grouped items, then the upgrade and floor. */
function PickerBody({
  row,
  number,
  depth,
  listClassName,
}: Omit<PickerProps, 'disabled'> & { listClassName?: string }) {
  const floor =
    FLOOR_LIMIT_OPTIONS[nearestOptionIndex(FLOOR_LIMIT_OPTIONS, depth)] ?? depth
  return (
    <>
      <ComboboxInput
        showTrigger={false}
        placeholder="Search items…"
        aria-label={`Search item ${number}`}
      />
      <ComboboxEmpty>No items match.</ComboboxEmpty>
      <ComboboxList className={cn('px-1 pb-1', listClassName)}>
        {(group: ItemChoiceGroup) => (
          <ComboboxGroup key={group.value} items={group.items}>
            <ComboboxLabel className="bg-popover sticky top-0 z-10 py-1.5 text-xs font-semibold">
              {group.value}
            </ComboboxLabel>
            <ComboboxCollection>
              {(entry: ItemChoice) => (
                <ComboboxItem key={entry.value} value={entry} className="py-1">
                  <ItemSprite
                    art={itemArt(rowSprite(entry.kind, entry.item))}
                    size={24}
                  />
                  {entry.label}
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxGroup>
        )}
      </ComboboxList>
      <RowLimits
        number={number}
        levels={upgradeLevels(row.kind, row.item)}
        minUpgrade={row.minUpgrade}
        depth={floor}
        onUpgrade={(minUpgrade) => setRowUpgrade(row.key, minUpgrade)}
        onDepth={(next) => setRowDepth(row.key, next)}
      />
    </>
  )
}

const comboboxProps = (row: SimpleConstraint) => ({
  items: ITEM_CHOICE_GROUPS as ItemChoiceGroup[],
  value: choiceFor(row.kind, row.item),
  isItemEqualToValue: sameChoice,
  onValueChange: (next: ItemChoice | null) => {
    if (next) setRowChoice(row.key, next.kind, next.item)
  },
})

/**
 * One Simple row as a searchable, grouped item menu. It stays open after a
 * pick so the upgrade and floor in its footer can follow; Done closes it.
 */
export function ItemPicker(props: PickerProps) {
  const phone = useMediaQuery(PHONE_QUERY)
  return phone ? <PhonePicker {...props} /> : <DropdownPicker {...props} />
}

function DropdownPicker({ row, number, depth, disabled }: PickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Combobox<ItemChoice>
      {...comboboxProps(row)}
      open={open}
      onOpenChange={(next, details) => {
        if (!next && details.reason === 'item-press') return
        setOpen(next)
      }}
      disabled={disabled}
    >
      <ComboboxTrigger
        aria-label={`Item ${number}`}
        title={choiceFor(row.kind, row.item).label}
        className={TRIGGER_CLASS}
      >
        <TriggerFace row={row} depth={depth} />
      </ComboboxTrigger>
      <ComboboxContent className="w-[min(22rem,var(--available-width))]">
        <PickerBody row={row} number={number} depth={depth} />
        <div className="flex justify-end border-t p-2">
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </ComboboxContent>
    </Combobox>
  )
}

function PhonePicker({ row, number, depth, disabled }: PickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Item ${number}`}
          disabled={disabled}
          className={TRIGGER_CLASS}
        >
          <TriggerFace row={row} depth={depth} />
          <CaretDownIcon className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        // The list comes first; the keyboard opens when the search is tapped.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="inset-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
          <DialogTitle className="font-pixel text-px-1">
            Item {number}
          </DialogTitle>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
        <Combobox<ItemChoice> {...comboboxProps(row)} inline open>
          <div className="flex min-h-0 flex-1 flex-col pt-1 *:data-[slot=input-group]:m-2 *:data-[slot=input-group]:mb-1">
            <PickerBody
              row={row}
              number={number}
              depth={depth}
              listClassName="max-h-none min-h-0 flex-1"
            />
          </div>
        </Combobox>
      </DialogContent>
    </Dialog>
  )
}
