import type { ReactNode } from 'react'
import type { ReportItem, ReportRange } from '../../../engine/types/report'
import { conditionDescription } from './report-text'

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
 * What the seed alone does not fix about an item (`allItems`): the
 * conditions it depends on and the ranges its upgrade, tier and quantity
 * can take. Nothing renders for an item the seed fixes outright.
 */
export function ItemConditionDetails({ item }: { item: ReportItem }) {
  const conditions = item.conditions ?? []
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

  return (
    <>
      {ranges.length > 0 ? (
        <Section title="Not fixed by the seed">
          {ranges.map((line) => (
            <p key={line} className="text-muted-foreground text-sm">
              {line}
            </p>
          ))}
        </Section>
      ) : null}
      {conditions.length > 0 ? (
        <Section title="Conditions">
          <p className="text-muted-foreground text-sm">
            This item appears as shown when all of these hold.
          </p>
          <ul className="text-muted-foreground flex list-disc flex-col gap-0.5 pl-4 text-sm">
            {conditions.map((condition, index) => (
              <li key={`${condition.type}-${index}`}>
                {conditionDescription(condition)}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  )
}
