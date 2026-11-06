import { InfoIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@seed-seeker/design/ui/popover'
import type {
  ReportFloor,
  ReportItem,
  SeedReport,
} from '../../../engine/types/report'
import type { RingGems } from '../../../shared/sprites/sprites'
import { floorItemGroups } from './floor-items'
import { ItemSlot } from './ItemSlot'
import { hasSection } from './report-text'

function VariableItemsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="About items that vary with gameplay"
        >
          <InfoIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Varies with gameplay</PopoverTitle>
          <PopoverDescription>
            Dashed slots are the items this seed rolls when gameplay has not
            shifted generation. Player choices, trinkets, challenges, or prior
            generation can change them, so they are not seed-wide guarantees.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}

/** A row of item slots. */
export function ItemList({
  items,
  ringGems,
}: {
  items: ReportItem[]
  ringGems?: RingGems
}) {
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <li key={`${item.id}-${index}`} className="shrink-0">
          <ItemSlot item={item} ringGems={ringGems} />
        </li>
      ))}
    </ul>
  )
}

function ItemGroupSection({
  label,
  items,
  empty,
  ringGems,
}: {
  label: string
  items: ReportItem[]
  empty?: string
  ringGems?: RingGems
}) {
  const variable = items.some((item) => item.prediction === 'variable')
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <p className="text-sm font-semibold">
          {label}
          {items.length > 0 ? (
            <span className="text-muted-foreground ml-2 font-normal tabular-nums">
              {items.length}
            </span>
          ) : null}
        </p>
        {variable ? <VariableItemsPopover /> : null}
      </div>
      {items.length > 0 ? (
        <ItemList items={items} ringGems={ringGems} />
      ) : empty ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : null}
    </section>
  )
}

/** A floor's notable, other and shop items. */
export function FloorItemSections({
  floor,
  report,
}: {
  floor: ReportFloor
  report: SeedReport
}) {
  const { notable, other, shop } = floorItemGroups(floor, report)
  const ringGems = hasSection(report, 'ringGems') ? report.ringGems : undefined
  return (
    <>
      <ItemGroupSection
        label="Notable"
        items={notable}
        empty="No notable items on this floor."
        ringGems={ringGems}
      />
      {other.length > 0 ? (
        <ItemGroupSection
          label="Other items"
          items={other}
          ringGems={ringGems}
        />
      ) : null}
      {shop.length > 0 ? (
        <ItemGroupSection label="Shop" items={shop} ringGems={ringGems} />
      ) : null}
    </>
  )
}
