import { MinusIcon, PlusIcon } from '@phosphor-icons/react'
import { cn } from '@seed-seeker/design/utils'
import { type CSSProperties, useEffect, useRef } from 'react'
import type { ChipView } from '../../../engine/types'
import { movingFace } from './drop'
import type { MenuState } from './use-board'

const ITEM =
  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted outline-none'
const GLYPH = 'w-4 text-center font-mono font-bold text-muted-foreground'
const RULE = 'my-1 block h-px bg-border'

/**
 * The chip's context menu: the gestures as words, for keyboard and touch. The
 * resin chip (`chip` null) is edited and removed like any chip, but stacks,
 * joins and detaches nothing.
 */
export function ChipMenu({
  state,
  chip,
  onClose,
  onEdit,
  onPick,
  onCount,
  onTotal,
  onDetach,
  onRemove,
}: {
  state: MenuState
  chip: ChipView | null
  onClose: () => void
  onEdit: () => void
  onPick: (key: number) => void
  onCount: (key: number, count: number) => void
  onTotal: (key: number) => void
  onDetach: (key: number) => void
  onRemove: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [onClose])
  const style: CSSProperties = {
    left: Math.max(8, Math.min(state.x, window.innerWidth - 230)),
    top: Math.max(8, Math.min(state.y, window.innerHeight - 260)),
  }
  const stack = chip?.stack
  return (
    <div
      ref={ref}
      data-slot="chip-menu"
      role="menu"
      aria-label={chip ? movingFace(chip).title : 'Arcane Resin'}
      className="fixed z-50 w-56 rounded-sm border bg-popover p-1 text-popover-foreground shadow-window"
      style={style}
    >
      {/* A chip without a kind is a row the core cannot read: only Remove applies. */}
      {chip?.kind !== null ? (
        <button type="button" role="menuitem" className={ITEM} onClick={onEdit}>
          <span className={GLYPH} />
          Edit…
        </button>
      ) : null}
      {chip && chip.join.length > 0 ? (
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          onClick={() => onPick(chip.key)}
        >
          <b className={GLYPH}>or</b>Either/or with…
        </button>
      ) : null}
      {chip && stack?.can_change_count ? (
        <>
          <span className={RULE} />
          <fieldset
            className="flex min-w-0 items-center justify-between gap-2 px-2 py-1 text-sm"
            aria-label="How many"
          >
            <span className="flex items-center gap-2">
              <b className={GLYPH}>×</b>How many
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                className={cn(ITEM, 'size-6 w-6 justify-center p-0')}
                aria-label="One fewer"
                disabled={stack.count <= 1}
                onClick={() => onCount(chip.key, stack.count - 1)}
              >
                <MinusIcon className="size-3" />
              </button>
              <span
                data-slot="menu-count"
                className="w-5 text-center font-mono"
              >
                {stack.count}
              </span>
              <button
                type="button"
                className={cn(ITEM, 'size-6 w-6 justify-center p-0')}
                aria-label="One more"
                disabled={stack.count >= stack.count_max}
                onClick={() => onCount(chip.key, stack.count + 1)}
              >
                <PlusIcon className="size-3" />
              </button>
            </span>
          </fieldset>
        </>
      ) : null}
      {chip && stack?.can_count_levels ? (
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          onClick={() => onTotal(chip.key)}
        >
          <b className={GLYPH}>Σ</b>
          {stack.total === null
            ? 'Count levels together'
            : 'Stop counting levels'}
        </button>
      ) : null}
      {chip?.can_detach ? (
        <>
          <span className={RULE} />
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => onDetach(chip.key)}
          >
            <span className={GLYPH} />
            On its own
          </button>
        </>
      ) : null}
      <span className={RULE} />
      <button
        type="button"
        role="menuitem"
        className={cn(ITEM, 'text-destructive')}
        onClick={onRemove}
      >
        <span className={GLYPH} />
        Remove
      </button>
    </div>
  )
}
