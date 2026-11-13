import { formatLevel, tierClass } from '@seed-seeker/design/spd/item-slot'
import { cn } from '@seed-seeker/design/utils'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import type { ReportItem } from '../../../engine/types/report'
import {
  type ItemArt,
  itemArt,
  type RingGems,
} from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import {
  scheduleHideItemDetail,
  showItemDetail,
  togglePinItemDetail,
} from './item-detail-store'
import { CURSE_BORDER, effectBorderColor } from './item-glow'
import { itemTitle } from './report-text'

/** The 17px journal cell plus 4px padding a side, at this scale. */
function slotSize(scale: number) {
  return 17 * scale + 8
}

/** One sprite in a recessed slot, without the item behaviour. */
export function SpriteSlot({
  art,
  label,
  scale = 2,
  caption,
  children,
}: {
  art: ItemArt
  label: string
  scale?: number
  caption?: string
  children?: ReactNode
}) {
  const size = slotSize(scale)
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="bg-muted inset-shadow-recessed relative inline-grid shrink-0 place-items-center border"
      style={{ width: size, height: size }}
    >
      <ItemSprite art={art} size={16 * scale} />
      {children}
      {caption ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[11px] leading-none text-white capitalize">
          {caption}
        </span>
      ) : null}
    </span>
  )
}

/**
 * An item from the report in its slot: the upgrade chip, the effect or
 * curse frame, the quantity, and a ring when the query matched it. Hover
 * shows its description; a click pins it.
 */
export function ItemSlot({
  item,
  ringGems,
  scale = 2,
}: {
  item: ReportItem
  ringGems?: RingGems
  scale?: number
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const size = slotSize(scale)
  const border =
    effectBorderColor(item.effect) ?? (item.cursed ? CURSE_BORDER : null)
  const quantity = item.ranges?.quantity
  const quantityText = quantity
    ? quantity.min === quantity.max
      ? quantity.min > 1
        ? String(quantity.min)
        : null
      : `${quantity.min}–${quantity.max}`
    : null
  const title = itemTitle(item)
  const label = [
    quantityText ? `${quantityText} × ${title}` : title,
    item.cursed ? 'cursed' : null,
    item.matched ? 'matches the query' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <button
      ref={ref}
      type="button"
      data-slot="item-box"
      data-matched={item.matched || undefined}
      data-prediction={item.prediction}
      aria-label={label}
      className={cn(
        'bg-muted inset-shadow-recessed relative grid shrink-0 cursor-pointer place-items-center border p-0 select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        item.matched &&
          'ring-primary ring-2 ring-offset-1 ring-offset-background',
        item.prediction === 'variable' && 'border-dashed'
      )}
      style={{
        width: size,
        height: size,
        borderColor: border ?? undefined,
        borderWidth: border ? 2 : undefined,
      }}
      onPointerEnter={() =>
        ref.current && showItemDetail(ref.current, { kind: 'item', item })
      }
      onPointerLeave={() => ref.current && scheduleHideItemDetail(ref.current)}
      onClick={() =>
        ref.current && togglePinItemDetail(ref.current, { kind: 'item', item })
      }
    >
      <ItemSprite
        art={itemArt(item.spriteIndex, ringGems, item.icon)}
        size={16 * scale}
      />
      {item.upgrade !== 0 ? (
        // `dark` scopes the bright tier colors: labels on art are outlined
        // in black in both themes, as in the game.
        <span
          data-upgrade={item.upgrade}
          className={cn(
            'dark ink-outline font-pixel text-px-1 pointer-events-none absolute -bottom-0.5 right-0.5 leading-[20px]',
            tierClass(item.upgrade)
          )}
        >
          {formatLevel(item.upgrade)}
        </span>
      ) : null}
      {quantityText ? (
        <span className="ink-outline font-pixel text-px-1 pointer-events-none absolute -top-0.5 left-0.5 leading-[20px] text-[#f0c040]">
          {quantityText}
        </span>
      ) : null}
    </button>
  )
}
