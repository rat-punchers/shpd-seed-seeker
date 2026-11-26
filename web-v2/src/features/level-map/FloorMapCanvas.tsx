import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { MapFrame } from './map-view'
import {
  type EffectsView,
  sameEffectsView,
  visibleEffects,
} from './rendering/effects-view'
import { createMapFrameRenderer } from './rendering/frame-renderer'
import { secretOverlay } from './rendering/secret-overlay'
import { SecretOverlayCanvas } from './SecretOverlayCanvas'
import type { MapBundle } from './types'

/** Sprite frames advance at most this often; particles follow the display. */
const SPRITE_FRAME_MS = 50

/** The revealed scenery, viewport-sized particles, and concealed secret overlay. */
export function FloorMapCanvas({
  bundle,
  focusCell,
  frame,
  moving,
  label,
}: {
  bundle: MapBundle
  focusCell: number | null
  frame: MapFrame | null
  moving: boolean
  label: string
}) {
  const { map } = bundle
  const tileSize = map.scene.tileSize
  const width = map.width * tileSize
  const height = map.height * tileSize
  const hasEffects = (map.scene.emitters?.length ?? 0) > 0
  const hostRef = useRef<HTMLDivElement>(null)
  const movingRef = useRef(false)
  const viewRef = useRef<EffectsView | null>(null)
  const updateRef = useRef<(() => void) | null>(null)
  const crops = useMemo(() => secretOverlay(bundle), [bundle])

  useLayoutEffect(() => {
    const hold = hasEffects && moving
    const wasMoving = movingRef.current
    movingRef.current = hold
    if (hold && viewRef.current) return
    const view = hasEffects
      ? visibleEffects(
          frame,
          width,
          height,
          tileSize,
          window.devicePixelRatio || 1
        )
      : null
    if (!sameEffectsView(view, viewRef.current) || wasMoving) {
      viewRef.current = view
      updateRef.current?.()
    }
  }, [frame, width, height, tileSize, moving, hasEffects])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = createMapFrameRenderer(host, bundle, label)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frameId = 0
    let last = Number.NEGATIVE_INFINITY
    let stopped = false
    let drawing = false
    let painted = false
    let redraw = true
    let onScreen = true
    const start = performance.now()
    const visible = () => onScreen && !document.hidden
    // The effects surface also contains scenery pixels for additive blending.
    // Hold both layers together while their existing crop tracks the gesture.
    const canDraw = () => visible() && (!movingRef.current || !painted)
    const schedule = () => {
      if (!stopped && !frameId && !drawing && canDraw()) {
        frameId = requestAnimationFrame(tick)
      }
    }
    const tick = (time: number) => {
      frameId = 0
      if (stopped || drawing || !canDraw()) return
      const advanceSprites = time - last >= SPRITE_FRAME_MS || motion.matches
      if (advanceSprites) last = time
      redraw = false
      drawing = true
      const effects = viewRef.current
      void renderer
        .draw({
          elapsed: motion.matches ? 0 : time - start,
          advanceSprites,
          effects,
        })
        .then((animated) => {
          if (stopped) return
          drawing = false
          painted = true
          if (redraw || (animated && !motion.matches)) schedule()
        })
    }
    const resume = () => {
      cancelAnimationFrame(frameId)
      frameId = 0
      redraw = true
      schedule()
    }
    updateRef.current = () => {
      redraw = true
      schedule()
    }
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      resume()
    })
    intersection.observe(host)
    tick(performance.now())
    document.addEventListener('visibilitychange', resume)
    motion.addEventListener('change', resume)
    return () => {
      stopped = true
      updateRef.current = null
      cancelAnimationFrame(frameId)
      renderer.dispose()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', resume)
      motion.removeEventListener('change', resume)
    }
  }, [bundle, label])

  return (
    <div
      className="absolute top-0 left-0 origin-top-left"
      style={{
        width,
        height,
        imageRendering: 'pixelated',
        transform: `scale(${frame?.view.zoom ?? 1})`,
      }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {crops.map((crop) => (
        <SecretOverlayCanvas
          key={crop.firstCell}
          crop={crop}
          columns={map.width}
          tileSize={tileSize}
          focusCell={focusCell}
        />
      ))}
    </div>
  )
}
