import { PlusIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '@seed-seeker/design/utils'
import type { ReactNode } from 'react'
import type { BoardItemView, ResinChipView } from '../../../engine/types'
import { BoardChip, DROP_STATE_CLASS, DragGhost } from './BoardChip'
import { CHIP_CLASS, ResinChipBody } from './ChipFace'
import { ChipMenu } from './ChipMenu'
import { ChipPopover } from './ChipPopover'
import { dropStateOf, movingFace } from './drop'
import { type Board, type BoardHandlers, useBoard } from './use-board'

export type { BoardEditReport } from './use-board'

function Cluster({ item, board }: { item: BoardItemView; board: Board }) {
  if (item.cluster === null) return null
  return (
    <fieldset
      data-slot="cluster"
      data-drop="cluster"
      data-group={item.cluster}
      data-drop-state={dropStateOf(board.drag?.over, board.hoverAction, {
        kind: 'cluster',
        group: item.cluster,
      })}
      aria-label={item.label ?? undefined}
      className={cn(
        'flex min-w-0 max-w-full flex-wrap items-center gap-1 rounded-sm border border-dashed border-input p-1',
        DROP_STATE_CLASS
      )}
    >
      {item.chips.map((chip, position) => (
        <span key={chip.key} className="flex max-w-full items-center gap-1">
          {position > 0 ? (
            <span
              className="text-muted-foreground font-mono text-xs"
              aria-hidden
            >
              or
            </span>
          ) : null}
          <BoardChip chip={chip} board={board} />
        </span>
      ))}
    </fieldset>
  )
}

/** The menu of the chip it was opened on. */
function BoardMenu({ board, hasResin }: { board: Board; hasResin: boolean }) {
  const { menu } = board
  if (!menu) return null
  const entry = menu.key !== 'resin' ? board.chips.get(menu.key) : undefined
  // The resin chip's menu has no requirement chip to draw from.
  if (!entry && !(menu.key === 'resin' && hasResin)) return null
  const close = () => board.setMenu(null)
  return (
    <ChipMenu
      state={menu}
      chip={entry?.chip ?? null}
      onClose={close}
      onEdit={() => {
        close()
        board.editChip(menu.key)
      }}
      onPick={(key) => {
        close()
        board.setPick({ source: key })
      }}
      onCount={(key, count) => board.edit({ type: 'set_count', key, count })}
      onTotal={(key) => {
        close()
        board.edit({ type: 'toggle_levels', key })
      }}
      onDetach={(key) => {
        close()
        board.edit({ type: 'detach', key })
      }}
      onRemove={() => {
        close()
        board.removeChip(menu.key)
      }}
    />
  )
}

/**
 * The requirement board: every requirement is a chip. Drop one chip onto
 * another for an either/or cluster, drag a chip out of its cluster to make it
 * standalone again. A stack badge (×N / ≤N) means "more of the same kind", a
 * Σ badge that a stack's items count their levels towards one total. Every
 * drag moves one item: for a stack, a bare copy of it, so the chip in flight
 * draws the core's `lifted` face without badges.
 *
 * The board draws what the shared core answers (its entries, their words,
 * which drops join and which are refused) and sends gestures back as edits.
 */
export function RequirementBoard({
  items,
  onEdits,
  onEdit,
  onAdd,
  resin,
}: {
  /** This section's entries, as the core drew them. */
  items: BoardItemView[]
  onEdits: BoardHandlers['onEdits']
  onEdit: BoardHandlers['onEdit']
  onAdd: () => void
  resin?: { chip: ResinChipView; onEdit: () => void; onRemove: () => void }
}) {
  const board = useBoard(items, {
    onEdits,
    onEdit,
    ...(resin
      ? { onResinEdit: resin.onEdit, onResinRemove: resin.onRemove }
      : {}),
  })
  const { drag, pick, menu, hovered, hoverAction, chips } = board
  const hoveredChip = hovered ? chips.get(hovered.key)?.chip : undefined
  const pickSource = pick ? chips.get(pick.source)?.chip : undefined
  // The pick prompt names the item that moves, as its chip now draws it.
  const statusLine =
    hoverAction?.type === 'refuse'
      ? hoverAction.message
      : pick
        ? `Either/or with… choose a chip${pickSource ? ` for ${movingFace(pickSource).title}` : ''}`
        : board.notice

  const renderItem = (item: BoardItemView): ReactNode => {
    if (item.cluster !== null)
      return <Cluster key={item.id} item={item} board={board} />
    const [chip] = item.chips
    return chip ? <BoardChip key={chip.key} chip={chip} board={board} /> : null
  }

  return (
    <div ref={board.wrapRef} className="flex flex-col gap-2">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a press on the board's empty space only closes its menu and stepper. */}
      <div
        data-slot="board"
        data-drop="board"
        data-drop-state={dropStateOf(drag?.over, hoverAction, {
          kind: 'board',
        })}
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm bg-muted/50 p-1.5 inset-shadow-recessed',
          DROP_STATE_CLASS
        )}
        onMouseDown={(event) => {
          // The steppers stop pointerdown, but the compatibility mousedown
          // still bubbles; closing the stepper here would unmount its buttons
          // before their click fires.
          if ((event.target as HTMLElement).closest('[data-no-drag]')) return
          board.setMenu(null)
          board.setStepper(null)
        }}
      >
        {items.map(renderItem)}
        {resin ? (
          <button
            type="button"
            data-slot="resin-chip"
            data-drop="resin"
            data-dragging={drag?.source === 'resin' || undefined}
            aria-label="Edit Arcane Resin"
            title={resin.chip.tooltip ?? undefined}
            className={cn(
              CHIP_CLASS,
              'cursor-grab hover:bg-muted data-[dragging]:opacity-40'
            )}
            {...board.gestures('resin')}
            onClick={(event) => {
              if (board.takeResinClickSuppression(event.detail > 0)) return
              resin.onEdit()
            }}
          >
            <ResinChipBody chip={resin.chip} />
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            CHIP_CLASS,
            'text-muted-foreground cursor-pointer border-dashed bg-transparent inset-shadow-none hover:bg-muted hover:text-foreground'
          )}
          onClick={onAdd}
          title="Add a requirement"
        >
          <PlusIcon className="size-3.5" />
          <span>Add</span>
        </button>
      </div>
      {drag ? (
        <div
          data-slot="delete-zone"
          data-drop="delete"
          data-over={drag.over?.kind === 'delete' || undefined}
          className="text-destructive flex items-center justify-center gap-1.5 rounded-sm border border-dashed border-destructive/60 p-2 text-xs data-[over]:bg-destructive/15"
        >
          <XIcon className="size-3" />
          <span>drop to remove</span>
        </div>
      ) : null}
      {statusLine ? (
        <div
          data-slot="board-status"
          className="text-muted-foreground font-mono text-xs"
          aria-live="polite"
        >
          {statusLine}
        </div>
      ) : null}
      {hovered && hoveredChip && !drag && !menu ? (
        <ChipPopover
          chip={hoveredChip}
          moving={pick?.source === hoveredChip.key}
          style={{ left: hovered.left, top: hovered.top }}
        />
      ) : null}
      <DragGhost board={board} resin={resin?.chip} />
      <BoardMenu board={board} hasResin={resin !== undefined} />
    </div>
  )
}
