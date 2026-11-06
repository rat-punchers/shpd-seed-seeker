import { cn } from '@seed-seeker/design/utils'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { MapSettingsPanel } from './MapSettingsPanel'
import {
  applyZoom,
  clamp,
  clampPan,
  layoutMapView,
  type MapFrame,
  type MapMetrics,
  type MapView,
  panBy,
  wheelZoomFactor,
  zoomAtPoint,
} from './map-view'

const ZOOM_STEP = 1.5
const KEY_PAN = 48

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [KEY_PAN, 0],
  ArrowRight: [-KEY_PAN, 0],
  ArrowUp: [0, KEY_PAN],
  ArrowDown: [0, -KEY_PAN],
}

function formatZoom(zoom: number) {
  return zoom.toFixed(4)
}

/**
 * The pannable, zoomable map surface: wheel, drag, pinch, the zoom buttons,
 * and arrow keys, +, - and 0 while it has focus. `data-zoom`, `data-pan-x`
 * and friends expose the view to tests.
 */
export function MapStage({
  contentWidth,
  contentHeight,
  rasterScale,
  children,
}: {
  contentWidth: number
  contentHeight: number
  /** Canvas backing-store scale. View zoom is applied as CSS size on top. */
  rasterScale: number
  children: (zoom: number) => ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<MapMetrics>({
    width: 0,
    height: 0,
    contentWidth,
    contentHeight,
    minZoom: 1,
    maxZoom: 1,
  })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; midX: number; midY: number } | null>(
    null
  )
  const [frame, setFrame] = useState<MapFrame | null>(null)

  useLayoutEffect(() => {
    const node = containerRef.current
    if (!node) return

    const measure = (refit: boolean) => {
      const width = node.clientWidth
      const height = node.clientHeight
      setFrame((current) => {
        const next = layoutMapView({
          width,
          height,
          contentWidth,
          contentHeight,
          rasterScale,
          previous: refit ? null : (current?.view ?? null),
        })
        metricsRef.current = {
          width,
          height,
          contentWidth,
          contentHeight,
          minZoom: next.minZoom,
          maxZoom: next.maxZoom,
        }
        return next
      })
    }

    measure(true)
    const observer = new ResizeObserver(() => measure(false))
    observer.observe(node)
    return () => observer.disconnect()
  }, [contentWidth, contentHeight, rasterScale])

  useLayoutEffect(() => {
    const node = containerRef.current
    if (!node) return

    // Native and non-passive, so a wheel or trackpad pinch zooms the map
    // instead of scrolling or zooming the page.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const metrics = metricsRef.current
      if (metrics.width <= 0 || metrics.height <= 0) return
      const rect = node.getBoundingClientRect()
      const factor = wheelZoomFactor({
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        pageHeight: metrics.height,
      })
      setFrame((current) =>
        applyZoom(
          current,
          metrics,
          factor,
          event.clientX - rect.left,
          event.clientY - rect.top
        )
      )
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  function zoomBy(factor: number) {
    const metrics = metricsRef.current
    setFrame((current) =>
      applyZoom(current, metrics, factor, metrics.width / 2, metrics.height / 2)
    )
  }

  function pointFrom(event: ReactPointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function rememberPinch() {
    const [first, second] = [...pointers.current.values()]
    if (!first || !second) {
      pinch.current = null
      return
    }
    pinch.current = {
      distance: Math.hypot(first.x - second.x, first.y - second.y),
      midX: (first.x + second.x) / 2,
      midY: (first.y + second.y) / 2,
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic or already-released pointers cannot be captured.
    }
    pointers.current.set(event.pointerId, pointFrom(event))
    rememberPinch()
  }

  function pinchTo(last: NonNullable<typeof pinch.current>) {
    const now = pinch.current
    if (!now || last.distance < 1 || now.distance < 1) return
    const metrics = metricsRef.current
    const factor = now.distance / last.distance
    setFrame((current) => {
      if (!current) return current
      const shifted: MapView = {
        ...current.view,
        x: current.view.x + (now.midX - last.midX),
        y: current.view.y + (now.midY - last.midY),
      }
      const zoom = clamp(
        shifted.zoom * factor,
        metrics.minZoom,
        metrics.maxZoom
      )
      return {
        ...current,
        view: clampPan(
          zoomAtPoint(shifted, zoom, now.midX, now.midY),
          metrics.width,
          metrics.height,
          metrics.contentWidth,
          metrics.contentHeight
        ),
      }
    })
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const next = pointFrom(event)
    pointers.current.set(event.pointerId, next)

    const last = pinch.current
    if (pointers.current.size >= 2 && last) {
      rememberPinch()
      pinchTo(last)
      return
    }
    const dx = next.x - previous.x
    const dy = next.y - previous.y
    if (dx === 0 && dy === 0) return
    setFrame((current) => panBy(current, metricsRef.current, dx, dy))
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    rememberPinch()
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const metrics = metricsRef.current
    const arrow = ARROWS[event.key]
    if (arrow) {
      setFrame((current) => panBy(current, metrics, arrow[0], arrow[1]))
    } else if (event.key === '+' || event.key === '=') {
      zoomBy(ZOOM_STEP)
    } else if (event.key === '-') {
      zoomBy(1 / ZOOM_STEP)
    } else if (event.key === '0') {
      // The zoom clamps up to its minimum, the fitted view.
      zoomBy(0)
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const zoom = frame?.view.zoom ?? 1
  const pannable =
    frame != null &&
    (contentWidth * zoom > frame.width + 1 ||
      contentHeight * zoom > frame.height + 1)
  const atMin = frame != null && zoom <= frame.minZoom * 1.001
  const atMax = frame != null && zoom >= frame.maxZoom * 0.999

  return (
    <div className="relative size-full">
      <MapSettingsPanel
        canZoomIn={!atMax}
        canZoomOut={!atMin}
        onZoomIn={() => zoomBy(ZOOM_STEP)}
        onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
      />
      <div
        ref={containerRef}
        role="application"
        aria-label="Floor map"
        aria-roledescription="pannable map"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the application region takes arrow keys, +, - and 0.
        tabIndex={0}
        className={cn(
          'focus-visible:ring-ring relative size-full cursor-default touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-inset',
          pannable && 'active:cursor-grabbing'
        )}
        data-testid="map-scroll-container"
        data-zoom={frame ? formatZoom(zoom) : undefined}
        data-min-zoom={frame ? formatZoom(frame.minZoom) : undefined}
        data-max-zoom={frame ? formatZoom(frame.maxZoom) : undefined}
        data-pan-x={frame ? frame.view.x.toFixed(2) : undefined}
        data-pan-y={frame ? frame.view.y.toFixed(2) : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
        onDragStart={(event) => event.preventDefault()}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            visibility: frame ? 'visible' : 'hidden',
            transform: `translate(${frame?.view.x ?? 0}px, ${frame?.view.y ?? 0}px)`,
          }}
        >
          {children(zoom)}
        </div>
      </div>
    </div>
  )
}
