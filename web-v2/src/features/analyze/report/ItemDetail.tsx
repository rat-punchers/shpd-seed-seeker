import { Badge } from '@seed-seeker/design/ui/badge'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReportItem } from '../../../engine/types/report'
import { ItemConditionDetails } from './ItemConditionDetails'
import {
  cancelHideItemDetail,
  getItemDetail,
  hideItemDetail,
  scheduleHideItemDetail,
  subscribeItemDetail,
} from './item-detail-store'
import {
  humanize,
  itemLocation,
  itemTitle,
  predictionLabel,
} from './report-text'

const PANEL_WIDTH = 320
const PANEL_GAP = 6

function accessText(item: ReportItem): string | null {
  switch (item.accessibility.type) {
    case 'choice':
      return `One option of choice ${item.accessibility.group + 1}; taking it rules out the others.`
    case 'scenarios':
      return 'Reachable only in some of the run’s choice scenarios.'
    default:
      return null
  }
}

/** Everything the report says about one item. */
export function ItemDetail({ item }: { item: ReportItem }) {
  const access = accessText(item)
  const prediction = predictionLabel(item.prediction)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-popover-foreground font-semibold">
          {itemTitle(item)}
        </p>
        {item.cursed ? <Badge variant="destructive">Cursed</Badge> : null}
        {item.matched ? <Badge>Matches the query</Badge> : null}
        {item.resinDonor ? (
          <Badge variant="secondary">Resin donor</Badge>
        ) : null}
        {item.excluded ? <Badge variant="outline">Excluded</Badge> : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {humanize(item.category)}
        {item.effect
          ? `, ${item.effect.kind === 'curse' ? 'cursed with' : 'enchanted with'} ${item.effect.name}`
          : null}
        {prediction ? `. ${prediction}.` : '.'}
      </p>
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
      <ItemConditionDetails item={item} />
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
      if (target.closest('[data-slot="item-box"]')) return
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
  return (
    <div
      ref={layerRef}
      data-slot="item-detail"
      role="dialog"
      aria-label={itemTitle(current.item)}
      className="bg-popover text-popover-foreground shadow-window inset-shadow-raised fixed z-50 max-h-80 overflow-y-auto rounded-lg border p-3.5 text-sm"
      style={{ width: PANEL_WIDTH, ...place }}
      onPointerEnter={cancelHideItemDetail}
      onPointerLeave={() => scheduleHideItemDetail(current.anchor)}
    >
      <ItemDetail item={current.item} />
    </div>
  )
}
