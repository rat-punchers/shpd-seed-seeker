import { Badge } from '@seed-seeker/design/ui/badge'
import type { ReportItemRef } from '../../../engine/types/report'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'

/** A Catalyst offer or transmutation result, as the game describes it. */
export function TrinketDetail({
  trinket,
  note,
}: {
  trinket: ReportItemRef
  note: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <ItemSprite art={itemArt(trinket.spriteIndex)} size={32} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-popover-foreground font-semibold">
              {trinket.name}
            </p>
            {trinket.matched ? <Badge>Used by the query</Badge> : null}
          </div>
          {trinket.description ? (
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {trinket.description}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground border-t pt-2 text-sm">{note}</p>
    </div>
  )
}
