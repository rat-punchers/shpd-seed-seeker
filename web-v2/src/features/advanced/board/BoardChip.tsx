import { cn } from '@seed-seeker/design/utils'
import type { ChipView, ResinChipView } from '../../../engine/types'
import { RemainingBadges, StackBadges } from './ChipBadges'
import { CHIP_CLASS, ItemFace, ResinChipBody } from './ChipFace'
import { dropStateOf, movingFace } from './drop'
import type { Board } from './use-board'

/** How a chip or the board looks while a chip in flight is held over it. */
export const DROP_STATE_CLASS =
  'data-[drop-state=alternative]:ring-2 data-[drop-state=alternative]:ring-primary data-[drop-state=refused]:ring-2 data-[drop-state=refused]:ring-destructive data-[drop-state=detach]:ring-2 data-[drop-state=detach]:ring-ring'

/** One requirement chip: its face, its badges, and every gesture on it. */
export function BoardChip({ chip, board }: { chip: ChipView; board: Board }) {
  const { drag, pick, hovered, hoverAction, chips } = board
  // A chip picked up to join is the moving item in place: it draws, and is
  // named by, the item that moves.
  const picked = pick?.source === chip.key
  const face = picked ? movingFace(chip) : chip
  const pickable =
    pick && !picked && chips.get(pick.source)?.chip.join.includes(chip.key)
  const dragged = drag?.source === chip.key
  return (
    // biome-ignore lint/a11y/useSemanticElements: a chip holds buttons of its own (its badges), which a button cannot.
    <div
      role="button"
      tabIndex={0}
      data-slot="chip"
      data-drop="chip"
      data-chip={chip.key}
      data-dragging={dragged || undefined}
      data-problem={chip.problem ? true : undefined}
      data-pick={picked ? 'source' : pickable ? 'pickable' : undefined}
      data-drop-state={dropStateOf(drag?.over, hoverAction, {
        kind: 'chip',
        key: chip.key,
      })}
      aria-label={face.description}
      className={cn(
        CHIP_CLASS,
        'cursor-grab hover:bg-muted data-[dragging]:opacity-40 data-[problem]:border-destructive data-[pick=source]:ring-2 data-[pick=source]:ring-primary data-[pick=pickable]:border-dashed data-[pick=pickable]:border-primary',
        DROP_STATE_CLASS
      )}
      {...board.gestures(chip.key)}
      onMouseEnter={(event) => board.setHovered(chip.key, event.currentTarget)}
      onMouseLeave={() => {
        if (hovered?.key === chip.key) board.setHovered(null)
      }}
      onFocus={(event) => board.setHovered(chip.key, event.currentTarget)}
      onBlur={() => {
        if (hovered?.key === chip.key) board.setHovered(null)
      }}
    >
      <ItemFace face={face} />
      {/* A chip picked up to join shows the one item that moves; a dragged
          chip's origin shows what its stack keeps while that item is away. */}
      {picked ? null : dragged && chip.remaining_badges ? (
        <RemainingBadges {...chip.remaining_badges} />
      ) : (
        <StackBadges
          chip={chip}
          stepper={board.stepper}
          onStepper={board.setStepper}
          edit={board.edit}
        />
      )}
    </div>
  )
}

/** The chip in flight under the pointer: the one item that moves, never its badges. */
export function DragGhost({
  board,
  resin,
}: {
  board: Board
  resin: ResinChipView | undefined
}) {
  const { drag, hoverAction } = board
  if (!drag) return null
  const source =
    drag.source === 'resin' ? undefined : board.chips.get(drag.source)?.chip
  const resinChip = drag.source === 'resin' ? resin : undefined
  if (!source && !resinChip) return null
  return (
    <div
      data-slot="chip-ghost"
      aria-hidden
      className={cn(
        CHIP_CLASS,
        'pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 shadow-window'
      )}
      style={{ left: drag.x, top: drag.y }}
    >
      {source ? <ItemFace face={movingFace(source)} /> : null}
      {resinChip ? <ResinChipBody chip={resinChip} amountOnly /> : null}
      {hoverAction?.type === 'join' ? (
        <span
          data-slot="ghost-tag"
          data-kind="or"
          className="text-primary font-mono text-xs font-bold"
        >
          or
        </span>
      ) : null}
      {drag.over?.kind === 'delete' ? (
        <span
          data-slot="ghost-tag"
          data-kind="remove"
          className="text-destructive font-mono text-xs font-bold"
        >
          remove
        </span>
      ) : null}
    </div>
  )
}
