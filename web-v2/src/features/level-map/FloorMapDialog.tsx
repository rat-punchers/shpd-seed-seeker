import {
  CaretLeftIcon,
  CaretRightIcon,
  MapTrifoldIcon,
  SpinnerGapIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@seed-seeker/design/ui/dialog'
import { type ReactNode, useRef, useState } from 'react'
import type { FloorFeeling } from '../../engine/types'
import { FloorStairs } from '../../shared/ui/FloorStairs'
import { InteractiveFloorMap, type MapFocus } from './InteractiveFloorMap'
import type { LevelMapRequest } from './types'
import { useLevelMap } from './use-level-map'

export interface FloorMapTarget {
  depth: number
  branch: number
  name?: string
  leading?: ReactNode
  trinket?: ReactNode
}

const headerButton =
  'touch-manipulation max-sm:size-11 aria-disabled:opacity-40'

/**
 * Map button for a floor or quest banner; opens the full map in a dialog.
 * The map loads when the dialog opens.
 */
export function FloorMapDialog({
  run,
  maps,
  initial,
}: {
  run: Omit<LevelMapRequest, 'depth' | 'branch'>
  maps: readonly FloorMapTarget[]
  initial: number
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState<MapFocus | null>(null)
  const [selection, setSelection] = useState<FloorMapTarget | null>(null)
  const start = maps[initial]
  if (!start) return null

  const selected = selection
    ? maps.findIndex(
        ({ depth, branch }) =>
          depth === selection.depth && branch === selection.branch
      )
    : initial
  const index = selected < 0 ? initial : selected
  const { depth, branch, name, leading, trinket } = maps[index] ?? start
  const dialogTitle = name ? `${name} - Floor ${depth}` : `Floor ${depth}`
  const mapLabel = `${start.name ? `${start.name} ` : ''}floor ${start.depth} map`

  function showMap(next: FloorMapTarget | undefined) {
    if (!next) return
    setSelection(next)
    setPinned(null)
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setSelection(null)
          setPinned(null)
        }
      }}
    >
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
        showCloseButton={false}
        aria-describedby={undefined}
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
        <MapBody
          request={{ ...run, depth, branch }}
          label={`Shattered Pixel Dungeon floor map, ${dialogTitle}`}
          pinned={pinned}
          onPin={setPinned}
          header={(feeling) => (
            <MapHeader
              title={dialogTitle}
              leading={leading}
              feeling={feeling}
              trinket={trinket}
              previous={
                maps[index - 1] ? () => showMap(maps[index - 1]) : undefined
              }
              next={
                maps[index + 1] ? () => showMap(maps[index + 1]) : undefined
              }
            />
          )}
        />
      </DialogContent>
    </Dialog>
  )
}

function MapHeader({
  title,
  leading,
  feeling,
  trinket,
  previous,
  next,
}: {
  title: string
  leading?: ReactNode
  feeling?: FloorFeeling
  trinket?: ReactNode
  previous?: () => void
  next?: () => void
}) {
  return (
    <DialogHeader className="shrink-0 flex-row items-center justify-between gap-2 pr-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          {leading ?? <FloorStairs feeling={feeling} />}
          <DialogTitle className="min-w-0" aria-live="polite">
            {title}
          </DialogTitle>
        </div>
        {trinket}
      </div>
      <div className="flex shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={headerButton}
          aria-label="Previous map"
          title="Previous map"
          aria-disabled={!previous}
          onClick={previous}
        >
          <CaretLeftIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={headerButton}
          aria-label="Next map"
          title="Next map"
          aria-disabled={!next}
          onClick={next}
        >
          <CaretRightIcon />
        </Button>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={headerButton}
            aria-label="Close"
            onTouchMove={(event) => event.stopPropagation()}
          >
            <XIcon />
          </Button>
        </DialogClose>
      </div>
    </DialogHeader>
  )
}

function MapBody({
  request,
  label,
  pinned,
  onPin,
  header,
}: {
  request: LevelMapRequest
  label: string
  pinned: MapFocus | null
  onPin: (focus: MapFocus | null) => void
  header: (feeling: FloorFeeling | undefined) => ReactNode
}) {
  const { state, retry } = useLevelMap(request)

  return (
    <>
      {header(state.status === 'ready' ? state.bundle.map.feeling : undefined)}
      <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden bg-black/80">
        {state.status === 'ready' ? (
          <InteractiveFloorMap
            key={`${request.depth}:${request.branch ?? 0}`}
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
    </>
  )
}
