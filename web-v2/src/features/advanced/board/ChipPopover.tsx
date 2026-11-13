import type { CSSProperties } from 'react'
import type { ChipView } from '../../../engine/types'
import { movingFace } from './drop'

/** The popover's mark for each relation line. */
const RELATION_GLYPHS: Record<ChipView['relations'][number]['glyph'], string> =
  {
    or: 'or',
    sum: 'Σ',
    times: '×',
  }

/**
 * The detail card under a hovered or focused chip. A chip picked up to join
 * (`moving`) describes the item that moves, which carries none of its stack.
 */
export function ChipPopover({
  chip,
  moving,
  style,
}: {
  chip: ChipView
  moving: boolean
  style: CSSProperties
}) {
  const face = moving ? movingFace(chip) : chip
  // A bare copy has no stack of its own to relate, nor the row's problem.
  const own = face === chip
  return (
    <div
      data-slot="chip-popover"
      role="tooltip"
      className="pointer-events-none fixed z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-sm border bg-popover p-2.5 text-sm text-popover-foreground shadow-window"
      style={style}
    >
      <div data-slot="popover-title" className="font-semibold">
        {face.title}
      </div>
      {face.details.length > 0 ? (
        <div className="text-muted-foreground text-xs">
          {face.details.join(' · ')}
        </div>
      ) : null}
      {own
        ? chip.relations.map((relation) => (
            <div
              key={relation.glyph}
              data-slot="popover-relation"
              className="flex gap-2 text-xs"
            >
              <span className="w-4 shrink-0 text-center font-mono font-bold">
                {RELATION_GLYPHS[relation.glyph]}
              </span>
              <span>{relation.text}</span>
            </div>
          ))
        : null}
      {own && chip.problem ? (
        <div data-slot="popover-problem" className="text-destructive text-xs">
          {chip.problem}
        </div>
      ) : null}
    </div>
  )
}
