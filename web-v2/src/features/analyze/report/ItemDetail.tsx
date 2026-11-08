import { Badge } from '@seed-seeker/design/ui/badge'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { ReportItem } from '../../../engine/types/report'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { ItemName } from './ItemName'
import { ItemRangeDetails } from './ItemRangeDetails'
import {
  cancelHideItemDetail,
  getItemDetail,
  hideItemDetail,
  scheduleHideItemDetail,
  subscribeItemDetail,
} from './item-detail-store'
import { itemLocation, itemTitle } from './report-text'
import { TrinketDetail } from './TrinketDetail'

const PANEL_WIDTH = 320
const PANEL_GAP = 6

function accessText(item: ReportItem): string | null {
  return item.accessibility.type === 'scenarios'
    ? 'Reachable only in some of the run’s choice scenarios.'
    : null
}

/** Everything the report says about one item, laid out like the map's tooltip. */
export function ItemDetail({ item }: { item: ReportItem }) {
  const access = accessText(item)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <ItemSprite
            art={itemArt(item.spriteIndex, undefined, item.icon)}
            size={32}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-popover-foreground font-semibold">
              <ItemName item={item} />
            </p>
            {item.cursed ? <Badge variant="destructive">Cursed</Badge> : null}
            {item.prediction === 'variable' ? (
              <Badge variant="warning">Varies with play</Badge>
            ) : null}
            {item.matched ? <Badge>Matches the query</Badge> : null}
            {item.resinDonor ? (
              <Badge variant="secondary">Resin donor</Badge>
            ) : null}
            {item.excluded ? <Badge variant="outline">Excluded</Badge> : null}
          </div>
          {item.description ? (
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {item.description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t pt-2">
        <p className="text-popover-foreground text-sm font-semibold">
          Where to find
        </p>
        <p className="text-muted-foreground text-sm">
          Floor {item.depth}, {itemLocation(item)}
        </p>
        {access ? (
          <p className="text-muted-foreground text-sm">{access}</p>
        ) : null}
      </div>
      <ItemRangeDetails item={item} />
    </div>
  )
}

function panelPosition(anchor: DOMRect) {
  const margin = 8
  const left = Math.min(
    Math.max(margin, anchor.left),
    Math.max(margin, window.innerWidth - PANEL_WIDTH - margin)
  )
  const below = anchor.bottom + PANEL_GAP
  const above = below + 240 > window.innerHeight && anchor.top > 240
  return {
    left,
    top: above ? undefined : below,
    bottom: above ? window.innerHeight - anchor.top + PANEL_GAP : undefined,
  }
}

/** The floating description panel every item slot shares. */
export function ItemDetailLayer() {
  const current = useSyncExternalStore(
    subscribeItemDetail,
    getItemDetail,
    () => null
  )
  const layerRef = useRef<HTMLDivElement>(null)
  // Bumped on scroll and resize so the panel follows its slot.
  const [, setFrame] = useState(0)

  useEffect(() => {
    if (!current) return
    const follow = () => {
      if (!current.anchor.isConnected) hideItemDetail()
      else setFrame((frame) => frame + 1)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideItemDetail()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (current.anchor.contains(target)) return
      if (layerRef.current?.contains(target)) return
      if (target.closest('[data-slot="item-box"], [data-slot="trinket-box"]'))
        return
      hideItemDetail()
    }
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [current])

  if (!current) return null
  const place = panelPosition(current.anchor.getBoundingClientRect())
  // Portaled: inside the report it would add a spaced child to the page and
  // shift the scroll position the moment it opens.
  return createPortal(
    <div
      ref={layerRef}
      data-slot="item-detail"
      role="dialog"
      aria-label={
        current.subject.kind === 'item'
          ? itemTitle(current.subject.item)
          : current.subject.trinket.name
      }
      className="bg-popover text-popover-foreground shadow-window inset-shadow-raised fixed z-50 max-h-80 overflow-y-auto rounded-lg border p-3.5 text-sm"
      style={{ width: PANEL_WIDTH, ...place }}
      onPointerEnter={cancelHideItemDetail}
      onPointerLeave={() => scheduleHideItemDetail(current.anchor)}
    >
      {current.subject.kind === 'item' ? (
        <ItemDetail item={current.subject.item} />
      ) : (
        <TrinketDetail
          trinket={current.subject.trinket}
          note={current.subject.note}
        />
      )}
    </div>,
    document.body
  )
}
