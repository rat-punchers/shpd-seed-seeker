/**
 * The one item description panel. Hovering a slot points it there; a click
 * pins it until the same slot is clicked again, Escape, or a click outside.
 */
import type { ReportItem } from '../../../engine/types/report'

const HIDE_MS = 160

export interface ItemDetailPanel {
  anchor: HTMLElement
  item: ReportItem
  pinned: boolean
}

let panel: ItemDetailPanel | null = null
let hideTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function clearHideTimer() {
  clearTimeout(hideTimer)
  hideTimer = undefined
}

export function subscribeItemDetail(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getItemDetail(): ItemDetailPanel | null {
  return panel
}

/** Points the panel at this slot unless another one is pinned. */
export function showItemDetail(anchor: HTMLElement, item: ReportItem): void {
  clearHideTimer()
  if (panel?.pinned || panel?.anchor === anchor) return
  panel = { anchor, item, pinned: false }
  emit()
}

/** Pins the panel on this slot, or closes it when it is pinned here. */
export function togglePinItemDetail(
  anchor: HTMLElement,
  item: ReportItem
): void {
  clearHideTimer()
  panel =
    panel?.pinned && panel.anchor === anchor
      ? null
      : { anchor, item, pinned: true }
  emit()
}

/** Closes shortly unless the pointer reaches another slot or the panel. */
export function scheduleHideItemDetail(anchor: HTMLElement): void {
  if (panel?.pinned || (panel && panel.anchor !== anchor)) return
  clearHideTimer()
  hideTimer = setTimeout(() => {
    hideTimer = undefined
    if (panel?.pinned) return
    panel = null
    emit()
  }, HIDE_MS)
}

export function cancelHideItemDetail(): void {
  clearHideTimer()
}

export function hideItemDetail(): void {
  clearHideTimer()
  if (!panel) return
  panel = null
  emit()
}
