import type { CSSProperties } from 'react'
import type { ReportItem } from '../../../engine/types/report'
import { effectTextColor } from './item-glow'
import { itemTitleParts } from './report-text'

/** An item's in-game title, with its effect and upgrade picked out in color. */
export function ItemName({ item }: { item: ReportItem }) {
  const { prefix, name, suffix, upgrade } = itemTitleParts(item)
  const color = effectTextColor(item.effect)
  const effectStyle: CSSProperties | undefined = color ? { color } : undefined
  return (
    <>
      {prefix ? (
        <span data-item-effect style={effectStyle}>
          {prefix}
        </span>
      ) : null}
      {name}
      {suffix ? (
        <span data-item-effect style={effectStyle}>
          {suffix}
        </span>
      ) : null}
      {upgrade ? (
        <>
          {' '}
          <span
            data-item-upgrade
            className={
              upgrade.startsWith('-') ? 'text-destructive' : 'text-tier-1'
            }
          >
            {upgrade}
          </span>
        </>
      ) : null}
    </>
  )
}
