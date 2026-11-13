import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useRef,
  useState,
} from 'react'
import { type DragSource, type DropTarget, targetAt } from './drop'

const DRAG_THRESHOLD = 5
const LONG_PRESS_MS = 480

/** A chip in flight: what it is, where it is held, and over which target. */
export interface DragState {
  source: DragSource
  x: number
  y: number
  over: DropTarget | null
}

interface Press {
  key: DragSource
  x: number
  y: number
  timer: number | undefined
  dragging: boolean
}

/** What a press on a chip turns into. */
export interface PointerActions {
  /** A press released without moving: a tap. */
  onTap: (key: DragSource) => void
  /** A touch held still: the chip's menu at the press. */
  onLongPress: (key: DragSource, x: number, y: number) => void
  /** A press that moved far enough to become a drag. */
  onDragStart: () => void
  /** A drag released over `state.over`. */
  onDrop: (state: DragState) => void
}

/**
 * Pointer handling for the board's chips: a tap, a long press on touch, or a
 * drag with its target under the pointer. The resin chip is a button, so a
 * gesture that already acted suppresses its click.
 */
export function usePointer(
  wrapRef: RefObject<HTMLDivElement | null>,
  actions: PointerActions
) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const pressRef = useRef<Press | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressResinClick = useRef(false)

  const updateDrag = (next: DragState | null) => {
    dragRef.current = next
    setDrag(next)
  }

  const onPointerDown =
    (key: DragSource) => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      if ((event.target as HTMLElement).closest('[data-no-drag]')) return
      if (key === 'resin') suppressResinClick.current = false
      event.currentTarget.setPointerCapture(event.pointerId)
      const timer =
        event.pointerType === 'mouse'
          ? undefined
          : window.setTimeout(() => {
              const press = pressRef.current
              if (!press || press.dragging) return
              pressRef.current = null
              // The release must not also open the resin chip's sheet.
              if (key === 'resin') suppressResinClick.current = true
              actions.onLongPress(key, press.x, press.y)
            }, LONG_PRESS_MS)
      pressRef.current = {
        key,
        x: event.clientX,
        y: event.clientY,
        timer,
        dragging: false,
      }
    }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current
    if (!press) return
    if (!press.dragging) {
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y)
      if (moved < DRAG_THRESHOLD) return
      window.clearTimeout(press.timer)
      press.dragging = true
      if (press.key === 'resin') suppressResinClick.current = true
      actions.onDragStart()
    }
    updateDrag({
      source: press.key,
      x: event.clientX,
      y: event.clientY,
      over: targetAt(wrapRef.current, event.clientX, event.clientY, press.key),
    })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current
    pressRef.current = null
    if (!press) return
    window.clearTimeout(press.timer)
    if (press.dragging) {
      const state = dragRef.current
      updateDrag(null)
      if (state)
        actions.onDrop({
          ...state,
          over: targetAt(
            wrapRef.current,
            event.clientX,
            event.clientY,
            state.source
          ),
        })
      return
    }
    // The resin chip is a button and handles its native click, keyboard included.
    if (press.key !== 'resin') actions.onTap(press.key)
  }

  /** Drops the press or drag in progress without acting on it. */
  const cancel = () => {
    const press = pressRef.current
    pressRef.current = null
    if (press) window.clearTimeout(press.timer)
    updateDrag(null)
  }

  /** Whether a click on the resin chip comes from a gesture that already acted. */
  const takeResinClickSuppression = (fromPointer: boolean): boolean => {
    const suppressed = suppressResinClick.current && fromPointer
    suppressResinClick.current = false
    return suppressed
  }

  return {
    drag,
    cancel,
    takeResinClickSuppression,
    handlers: (key: DragSource) => ({
      onPointerDown: onPointerDown(key),
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
    }),
  }
}
