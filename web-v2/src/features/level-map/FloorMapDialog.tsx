import { MapTrifoldIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@seed-seeker/design/ui/dialog'
import { useRef, useState } from 'react'
import { InteractiveFloorMap, type MapFocus } from './InteractiveFloorMap'
import type { LevelMapRequest } from './types'
import { useLevelMap } from './use-level-map'

/**
 * Map button for a floor or quest banner; opens the full map in a dialog.
 * The map loads when the dialog opens.
 */
export function FloorMapDialog({
  request,
  mapLabel = `floor ${request.depth} map`,
  dialogTitle = `Floor ${request.depth}`,
}: {
  request: LevelMapRequest
  /** Ends the trigger's name: `Expand {mapLabel}`. */
  mapLabel?: string
  dialogTitle?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState<MapFocus | null>(null)

  return (
    <Dialog onOpenChange={() => setPinned(null)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          // Dialog triggers set aria-haspopup, which skips the shared press offset.
          className="active:translate-y-px"
          title={`Open the ${mapLabel}`}
          aria-label={`Expand ${mapLabel}`}
        >
          <MapTrifoldIcon className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        ref={contentRef}
        className="inset-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden rounded-none sm:top-1/2 sm:left-1/2 sm:h-[min(94vh,72rem)] sm:w-[min(96vw,80rem)] sm:max-w-[min(96vw,80rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        onEscapeKeyDown={(event) => {
          // The first Escape unpins the tile details; the next one closes.
          if (!pinned) return
          event.preventDefault()
          setPinned(null)
        }}
      >
        <DialogHeader className="shrink-0 pr-14">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Items, mobs, and traps as generated for this seed. Secret rooms,
            doors and traps fade in and out. Hover or tap a tile to inspect it.
          </DialogDescription>
        </DialogHeader>
        <MapBody
          request={request}
          label={`Shattered Pixel Dungeon floor map, ${dialogTitle}`}
          pinned={pinned}
          onPin={setPinned}
        />
      </DialogContent>
    </Dialog>
  )
}

function MapBody({
  request,
  label,
  pinned,
  onPin,
}: {
  request: LevelMapRequest
  label: string
  pinned: MapFocus | null
  onPin: (focus: MapFocus | null) => void
}) {
  const { state, retry } = useLevelMap(request)

  return (
    <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden bg-black/80">
      {state.status === 'ready' ? (
        <InteractiveFloorMap
          bundle={state.bundle}
          label={label}
          pinned={pinned}
          onPin={onPin}
        />
      ) : state.status === 'error' ? (
        <div
          role="alert"
          className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-white"
        >
          <p className="font-semibold">Couldn’t load this map.</p>
          <p className="text-sm text-white/80">{state.error}</p>
          <Button type="button" variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex size-full items-center justify-center gap-2 text-white">
          <SpinnerGapIcon className="size-5 animate-spin" />
          <p role="status" className="text-sm">
            Charting {request.branch ? 'the quest level' : 'the floor'}…
          </p>
        </div>
      )}
    </div>
  )
}
