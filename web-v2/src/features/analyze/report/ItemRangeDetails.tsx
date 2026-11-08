import type { ReactNode } from 'react'
import type { ReportItem, ReportRange } from '../../../engine/types/report'

function rangeText(range: ReportRange, prefix = ''): string {
  return range.min === range.max
    ? `${prefix}${range.min}`
    : `${prefix}${range.min} to ${prefix}${range.max}`
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t pt-2">
      <p className="text-popover-foreground text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}

/**
 * The ranges an item's upgrade, tier and quantity can take when the seed
 * alone does not fix them (`allItems`). Nothing renders for exact ranges.
 */
export function ItemRangeDetails({ item }: { item: ReportItem }) {
  const { level, tier, quantity } = item.ranges ?? {}
  const ranges = [
    level && level.min !== level.max
      ? `Starts between ${rangeText(level, '+')}.`
      : null,
    tier && tier.min !== tier.max ? `Tier ${rangeText(tier)}.` : null,
    quantity && quantity.min !== quantity.max
      ? `Quantity ${rangeText(quantity)}.`
      : null,
  ].filter((line): line is string => line !== null)

  if (ranges.length === 0) return null
  return (
    <Section title="Not fixed by the seed">
      {ranges.map((line) => (
        <p key={line} className="text-muted-foreground text-sm">
          {line}
        </p>
      ))}
    </Section>
  )
}
