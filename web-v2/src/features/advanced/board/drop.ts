import type { BoardItemView, ChipFace, ChipView } from '../../../engine/types'

/** Where a chip in flight is held. */
export type DropTarget =
  | { kind: 'chip'; key: number }
  | { kind: 'cluster'; group: number }
  | { kind: 'delete' }
  | { kind: 'board' }

/** What releasing a chip over a target does. */
export type DropAction =
  | { type: 'join'; target: number }
  | { type: 'refuse'; message: string }
  | { type: 'detach' }
  | { type: 'remove_one' }

/** What a gesture holds: a requirement chip by key, or the resin chip. */
export type DragSource = number | 'resin'

/** How a target draws while a chip is held over it. */
export type DropState = 'alternative' | 'refused' | 'detach'

/** Every visible row by key, with the entry it belongs to. */
export type ChipIndex = Map<number, { chip: ChipView; item: BoardItemView }>

export function indexChips(items: BoardItemView[]): ChipIndex {
  const byKey: ChipIndex = new Map()
  for (const item of items)
    for (const chip of item.chips) byKey.set(chip.key, { chip, item })
  return byKey
}

/**
 * The face of the item a move of `chip` carries: the bare copy the core lifts
 * from a stack, else the chip itself.
 */
export const movingFace = (chip: ChipView): ChipFace => chip.lifted ?? chip

/** The drop target under a point, inside `wrap`. */
export function targetAt(
  wrap: HTMLElement | null,
  x: number,
  y: number,
  source: DragSource
): DropTarget | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>('[data-drop]')
  if (!element || !wrap?.contains(element)) return null
  const kind = element.dataset.drop
  // Resin can be removed by dragging, but never joins an either/or group.
  if (kind === 'resin' || (source === 'resin' && kind !== 'delete')) return null
  if (kind === 'chip')
    return { kind: 'chip', key: Number(element.dataset.chip) }
  if (kind === 'cluster')
    return { kind: 'cluster', group: Number(element.dataset.group) }
  if (kind === 'delete') return { kind: 'delete' }
  return { kind: 'board' }
}

/** The drop the core allows: a join it lists, a refusal it words, or a detach. */
export function dropAction(
  chips: ChipIndex,
  items: BoardItemView[],
  source: number,
  over: DropTarget
): DropAction | null {
  const chip = chips.get(source)?.chip
  if (!chip) return null
  // The remove target takes one item; the menu's Remove takes the whole stack.
  if (over.kind === 'delete') return { type: 'remove_one' }
  if (over.kind === 'board') return chip.can_detach ? { type: 'detach' } : null
  const targets =
    over.kind === 'chip'
      ? [over.key]
      : (items.find((item) => item.cluster === over.group)?.members ?? [])
  const target = targets.find((key) => chip.join.includes(key))
  if (target !== undefined) return { type: 'join', target }
  const refusal = chip.refuse.find((entry) => targets.includes(entry.key))
  return refusal ? { type: 'refuse', message: refusal.message } : null
}

export function sameTarget(left: DropTarget, right: DropTarget): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'chip' && right.kind === 'chip')
    return left.key === right.key
  if (left.kind === 'cluster' && right.kind === 'cluster')
    return left.group === right.group
  return true
}

/** How `target` draws, given where the chip in flight is held and what that does. */
export function dropStateOf(
  over: DropTarget | null | undefined,
  action: DropAction | null,
  target: DropTarget
): DropState | undefined {
  if (!over || !action || !sameTarget(over, target)) return undefined
  if (action.type === 'detach') return 'detach'
  if (action.type === 'join') return 'alternative'
  if (action.type === 'refuse') return 'refused'
  return undefined
}
