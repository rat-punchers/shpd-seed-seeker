import { cn } from '@seed-seeker/design/utils'
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from 'react'
import { FloorMapCanvas } from './FloorMapCanvas'
import {
  hasInspection,
  inspectPoint,
  itemBounds,
  type MapInspection,
} from './item-inspection'
import { MapInspectPanel } from './MapInspectPanel'
import { MapStage } from './MapStage'
import type { MapBundle } from './types'

/** Pointer travel (CSS px) above which a press is a pan, not a tap. */
const TAP_SLOP = 5
const PANEL_GAP = 14
const PANEL_MAX = 320
const EDGE = 8
/** Below this container width the panel docks to the bottom edge. */
const DOCK_BELOW = 640

/** A point on the map: map pixels, and where it sits in the section. */
export interface MapFocus {
  mapX: number
  mapY: number
  x: number
  y: number
}

function panelStyle(focus: MapFocus, width: number, height: number) {
  if (width < DOCK_BELOW) {
    return {
      left: EDGE,
      right: EDGE,
      bottom: EDGE,
      width: 'auto',
      maxWidth: 'none',
      maxHeight: Math.min(PANEL_MAX, height / 2),
    } satisfies CSSProperties
  }
  const style: CSSProperties = {}
  if (focus.x > width / 2) style.right = width - focus.x + PANEL_GAP
  else style.left = focus.x + PANEL_GAP
  if (focus.y > height / 2) {
    style.bottom = height - focus.y + PANEL_GAP
    style.maxHeight = Math.min(PANEL_MAX, focus.y - PANEL_GAP - EDGE)
  } else {
    style.top = focus.y + PANEL_GAP
    style.maxHeight = Math.min(PANEL_MAX, height - focus.y - PANEL_GAP - EDGE)
  }
  return style
}

/**
 * Pannable floor map with tile inspection: hover shows what the tile holds,
 * a tap or click pins it, and Escape (handled by the dialog) unpins it.
 */
export function InteractiveFloorMap({
  bundle,
  label,
  pinned,
  onPin,
}: {
  bundle: MapBundle
  label: string
  pinned: MapFocus | null
  onPin: (focus: MapFocus | null) => void
}) {
  const { map } = bundle
  const tile = map.scene.tileSize
  const rootRef = useRef<HTMLElement>(null)
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  const [hover, setHover] = useState<MapFocus | null>(null)

  const inspect = (focus: MapFocus | null): MapInspection | null =>
    focus ? inspectPoint(map, focus.mapX, focus.mapY) : null

  function focusAt(clientX: number, clientY: number): MapFocus | null {
    const root = rootRef.current
    const canvas = root?.querySelector('canvas[data-map-canvas]')
    if (!root || !canvas) return null
    const rect = canvas.getBoundingClientRect()
    const fx = (clientX - rect.left) / rect.width
    const fy = (clientY - rect.top) / rect.height
    if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return null
    const rootRect = root.getBoundingClientRect()
    return {
      mapX: fx * map.width * tile,
      mapY: fy * map.height * tile,
      x: clientX - rootRect.left,
      y: clientY - rootRect.top,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.buttons !== 0) {
      if (hover) setHover(null)
      return
    }
    const next = focusAt(event.clientX, event.clientY)
    if (inspect(next)?.cell !== inspect(hover)?.cell) setHover(next)
  }

  function onClick(event: ReactMouseEvent<HTMLElement>) {
    const press = pressRef.current
    pressRef.current = null
    if (
      event.target instanceof Element &&
      event.target.closest('[data-slot="map-inspect"]')
    ) {
      return
    }
    if (
      press &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP
    ) {
      return
    }
    const next = focusAt(event.clientX, event.clientY)
    const target = inspect(next)
    if (!next || !hasInspection(target)) {
      onPin(null)
      return
    }
    onPin(inspect(pinned)?.cell === target?.cell ? null : next)
  }

  const panelFocus = pinned ?? hover
  const inspection = inspect(panelFocus)
  const showPanel = inspection !== null && hasInspection(inspection)
  const hoverInspectable = hasInspection(inspect(hover))
  const root = rootRef.current
  const highlights = [inspect(pinned), showPanel ? inspection : null]
  const contentWidth = map.width * tile
  const contentHeight = map.height * tile

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the map stage inside takes the keyboard; a click only pins a tile.
    <section
      ref={rootRef}
      aria-label="Floor map with tile details"
      className="relative size-full"
      data-testid="interactive-floor-map"
      onPointerDownCapture={(event) => {
        pressRef.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      onClick={onClick}
    >
      <MapStage
        contentWidth={contentWidth}
        contentHeight={contentHeight}
        rasterScale={1}
      >
        {(zoom) => (
          <div
            className={cn(
              'relative leading-none',
              hoverInspectable && 'cursor-pointer'
            )}
          >
            <FloorMapCanvas
              bundle={bundle}
              focusCell={inspection?.cell ?? null}
              displayScale={zoom}
              label={label}
            />
            {[
              ...new Map(
                highlights.flatMap((entry) =>
                  entry ? [[entry.cell, entry] as const] : []
                )
              ).values(),
            ].map((entry) => (
              <CellHighlight
                key={entry.cell}
                inspection={entry}
                columns={map.width}
                tile={tile}
                contentWidth={contentWidth}
                contentHeight={contentHeight}
              />
            ))}
          </div>
        )}
      </MapStage>
      {showPanel && panelFocus && root ? (
        <MapInspectPanel
          inspection={inspection}
          bundle={bundle}
          pinned={pinned !== null}
          style={panelStyle(panelFocus, root.clientWidth, root.clientHeight)}
        />
      ) : null}
    </section>
  )
}

/** Outlines the inspected sprite or cell; dashed when it is a secret. */
function CellHighlight({
  inspection,
  columns,
  tile,
  contentWidth,
  contentHeight,
}: {
  inspection: MapInspection
  columns: number
  tile: number
  contentWidth: number
  contentHeight: number
}) {
  const { tip, cell } = inspection
  const [left, top, width, height] = tip
    ? itemBounds(tip, columns, tile)
    : [(cell % columns) * tile, Math.floor(cell / columns) * tile, tile, tile]
  return (
    <div
      aria-hidden
      className={cn(
        'outline-primary pointer-events-none absolute outline-2',
        tip?.hidden && 'outline-dashed'
      )}
      style={{
        left: `${(left / contentWidth) * 100}%`,
        top: `${(top / contentHeight) * 100}%`,
        width: `${(width / contentWidth) * 100}%`,
        height: `${(height / contentHeight) * 100}%`,
      }}
    />
  )
}
