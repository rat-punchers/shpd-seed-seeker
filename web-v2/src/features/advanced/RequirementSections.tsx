import { CaretRightIcon, InfoIcon } from '@phosphor-icons/react'
import { Badge } from '@seed-seeker/design/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@seed-seeker/design/ui/tooltip'
import { useStore } from '@tanstack/react-store'
import { useEffect } from 'react'
import { $query } from '../../app/store/query'
import type { BoardResponse } from '../../engine/types'
import { RequirementBoard } from './board/RequirementBoard'
import { $savedFocus, applyBoardEdits, openEditor, removeResin } from './store'

function BlanketHelp() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex"
          aria-label="About blanket requirements"
          onClick={(event) => event.preventDefault()}
        >
          <InfoIcon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-80 flex-col gap-2 text-left">
        <span>
          Add the items you need under Requirements, then add extra filters
          here. Each blanket must match at least one item fulfilling your
          requirements above, including wands contributing Arcane Resin. It does
          not require another item.
        </span>
        <span>
          Choose Any item in a category to let any of your required items in
          that category satisfy the blanket. All filters in one blanket apply to
          the same item; separate blankets can match the same or different
          items.
        </span>
        <span>
          For example, require Lightning, Disintegration, and Frost wands at +2
          or higher. Add an Any wand blanket with exactly +3 and Wandmaker
          Reward as its source to require one of those three wands to be the
          Wandmaker’s +3 reward.
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

/** The Requirements board, and the Blanket Requirements board under it. */
export function RequirementSections({ board }: { board: BoardResponse }) {
  const query = useStore($query)
  const saved = useStore($savedFocus)
  const { items, counts, resin: resinChip } = board

  // A save lands on a chip, possibly a new one at the end of a long board.
  useEffect(() => {
    if (saved)
      document
        .querySelector(`[data-chip="${saved.key}"]`)
        ?.scrollIntoView?.({ block: 'nearest' })
  }, [saved])

  const boardFor = (blanket: boolean) => (
    <RequirementBoard
      items={items.filter((item) => item.blanket === blanket)}
      {...(!blanket && query.arcaneResin && resinChip
        ? {
            resin: {
              chip: resinChip,
              onEdit: () => void openEditor({ type: 'resin' }),
              onRemove: removeResin,
            },
          }
        : {})}
      onEdits={applyBoardEdits}
      onEdit={(key) => openEditor({ type: 'row', key })}
      onAdd={() => void openEditor({ type: 'new', blanket })}
    />
  )

  return (
    <>
      <section aria-label="Requirements" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Requirements</h3>
        {boardFor(false)}
      </section>
      <section aria-label="Blanket Requirements">
        <details className="group/blanket flex flex-col gap-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <CaretRightIcon className="size-3.5 transition-transform group-open/blanket:rotate-90" />
            <span>Blanket Requirements</span>
            {counts.blanket > 0 ? (
              <Badge variant="secondary">{counts.blanket}</Badge>
            ) : null}
            <BlanketHelp />
          </summary>
          <div className="pt-2">{boardFor(true)}</div>
        </details>
      </section>
    </>
  )
}
