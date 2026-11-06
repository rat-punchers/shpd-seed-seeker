import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { BoardEdit, BoardItemView } from '../../../engine/types'
import { rekey } from '../../query/requirements/board'
import {
  type DragSource,
  type DropAction,
  type DropTarget,
  dropAction,
  indexChips,
} from './drop'
import { type DragState, usePointer } from './pointer'

export type { DragState } from './pointer'

/** How long a refusal stays in the status line. */
const NOTICE_MS = 4_000

/** What an edit did, as far as the board's own state cares. */
export interface BoardEditReport {
  /** A refusal or failure to say. */
  notice: string | null
  /** Keys the core renumbered, `[old, new]`. */
  rekeyed: [number, number][]
}

export interface BoardHandlers {
  onEdits: (edits: BoardEdit[]) => BoardEditReport
  /** Opens the sheet on a chip, or answers why the core will not. */
  onEdit: (key: number) => string | null
  onResinEdit?: () => void
  onResinRemove?: () => void
}

export interface MenuState {
  /** The chip the menu belongs to; the resin chip's menu only edits and removes. */
  key: DragSource
  x: number
  y: number
}
export interface StepperState {
  key: number
  which: 'count' | 'total'
}
export interface Hovered {
  key: number
  left: number
  top: number
}

/**
 * The board's gestures: drag and drop, long press and context menu, pick
 * mode, the badge steppers and the status line. Board state names rows by
 * key, which the core keeps stable across edits or reports as renumbered.
 */
export function useBoard(items: BoardItemView[], handlers: BoardHandlers) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [pick, setPick] = useState<{ source: number } | null>(null)
  const [stepper, setStepper] = useState<StepperState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hovered, setHoveredState] = useState<Hovered | null>(null)
  const chips = useMemo(() => indexChips(items), [items])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const edit = (...edits: BoardEdit[]) => {
    const report = handlers.onEdits(edits)
    setNotice(report.notice)
    const { rekeyed } = report
    if (rekeyed.length === 0) return
    const moved = <T extends { key: number }>(current: T | null) =>
      current && { ...current, key: rekey(current.key, rekeyed) }
    setMenu(
      (current) =>
        current &&
        (current.key === 'resin'
          ? current
          : { ...current, key: rekey(current.key, rekeyed) })
    )
    setHoveredState(moved)
    setStepper(moved)
  }

  const setHovered = (key: number | null, element?: HTMLElement) => {
    if (key === null || !element) {
      setHoveredState(null)
      return
    }
    const rect = element.getBoundingClientRect()
    setHoveredState({
      key,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
      top: rect.bottom + 8,
    })
  }

  const actionFor = (source: number, over: DropTarget) =>
    dropAction(chips, items, source, over)

  const perform = (source: number, action: DropAction | null) => {
    if (!action) return
    if (action.type === 'refuse') setNotice(action.message)
    else if (action.type === 'join')
      edit({ type: 'join', source, target: action.target })
    else edit({ type: action.type, key: source })
  }

  const editChip = (key: DragSource) => {
    if (key === 'resin') handlers.onResinEdit?.()
    // The core refuses to open a row it cannot read, and says why.
    else if (chips.has(key)) setNotice(handlers.onEdit(key))
  }

  const removeChip = (key: DragSource) => {
    if (key === 'resin') handlers.onResinRemove?.()
    else edit({ type: 'remove', key })
  }

  /** Completes pick mode on `key`: the menu's and the keyboard's way to drop. */
  const pickChip = (source: number, key: number) => {
    setPick(null)
    if (key !== source)
      perform(source, actionFor(source, { kind: 'chip', key }))
  }

  const tap = (key: DragSource) => {
    if (pick && key !== 'resin') pickChip(pick.source, key)
    else editChip(key)
  }

  const pointer = usePointer(wrapRef, {
    onTap: tap,
    onLongPress: (key, x, y) => setMenu({ key, x, y }),
    onDragStart: () => {
      setMenu(null)
      setHovered(null)
      setPick(null)
      setStepper(null)
      setNotice(null)
    },
    onDrop: ({ source, over }: DragState) => {
      if (!over) return
      if (source === 'resin') {
        if (over.kind === 'delete') handlers.onResinRemove?.()
        return
      }
      perform(source, actionFor(source, over))
    },
  })
  const { drag } = pointer
  const cancelRef = useRef(pointer.cancel)
  cancelRef.current = pointer.cancel

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      cancelRef.current()
      setMenu(null)
      setPick(null)
      setStepper(null)
      setNotice(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onKeyDown =
    (key: DragSource) => (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        // The resin chip is a button; its native click opens its sheet.
        if (key === 'resin') return
        event.preventDefault()
        tap(key)
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeChip(key)
      } else if (
        event.key === 'ContextMenu' ||
        (event.shiftKey && event.key === 'F10') ||
        event.key === '.'
      ) {
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        setMenu({ key, x: rect.left, y: rect.bottom })
      }
    }

  const onContextMenu =
    (key: DragSource) => (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault()
      setMenu({ key, x: event.clientX, y: event.clientY })
    }

  /** What releasing the chip in flight over its target would do. */
  const hoverAction =
    drag?.over && drag.source !== 'resin'
      ? actionFor(drag.source, drag.over)
      : null

  return {
    wrapRef,
    chips,
    drag,
    menu,
    setMenu,
    pick,
    setPick,
    stepper,
    setStepper,
    notice,
    hovered,
    setHovered,
    hoverAction,
    edit,
    editChip,
    removeChip,
    takeResinClickSuppression: pointer.takeResinClickSuppression,
    gestures: (key: DragSource) => ({
      ...pointer.handlers(key),
      onKeyDown: onKeyDown(key),
      onContextMenu: onContextMenu(key),
    }),
  }
}

export type Board = ReturnType<typeof useBoard>
