import { useEffect, useMemo, useRef } from 'react'
import { createMapFrameRenderer } from './rendering/frame-renderer'
import { paintSecretOverlay, secretOverlay } from './rendering/secret-overlay'
import type { MapBundle } from './types'

/** Sprite frames advance at most this often; particles follow the display. */
const SPRITE_FRAME_MS = 50

/**
 * The map's three surfaces: the revealed floor at one canvas pixel per map
 * pixel, particles at the displayed density, and the concealed floor over
 * both, fading in and out where secrets hide. All are sized by
 * `displayScale` in CSS. Animation pauses off-screen, in a hidden tab, and
 * with reduced motion, which draws the first frame only and holds the
 * secrets half faded.
 */
export function FloorMapCanvas({
  bundle,
  focusCell,
  displayScale,
  label,
}: {
  bundle: MapBundle
  /** The inspected cell; its secret region is shown revealed. */
  focusCell: number | null
  displayScale: number
  label: string
}) {
  const { map } = bundle
  const width = map.width * map.scene.tileSize
  const height = map.height * map.scene.tileSize
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particleRef = useRef<HTMLCanvasElement>(null)
  const secretRef = useRef<HTMLCanvasElement>(null)
  const overlay = useMemo(() => secretOverlay(bundle), [bundle])
  const densityRef = useRef(1)
  densityRef.current = Math.max(
    1,
    Math.min(4, displayScale * (window.devicePixelRatio || 1))
  )

  useEffect(() => {
    const context = secretRef.current?.getContext('2d')
    if (!context) return
    paintSecretOverlay(
      context,
      overlay,
      map.width,
      map.scene.tileSize,
      focusCell
    )
  }, [overlay, map, focusCell])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const particleContext = particleRef.current?.getContext('2d')
    if (!canvas || !context || !particleContext) return
    const renderer = createMapFrameRenderer(
      context,
      particleContext,
      bundle,
      true
    )
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let last = Number.NEGATIVE_INFINITY
    let stopped = false
    let drawing = false
    let redraw = true
    let onScreen = true
    const start = performance.now()
    const visible = () => onScreen && !document.hidden
    const schedule = () => {
      if (!stopped && !frame && !drawing && visible()) {
        frame = requestAnimationFrame(tick)
      }
    }
    const tick = (time: number) => {
      frame = 0
      if (stopped || drawing || !visible()) return
      const advanceSprites = time - last >= SPRITE_FRAME_MS || motion.matches
      if (advanceSprites) last = time
      redraw = false
      drawing = true
      void renderer
        .draw(
          motion.matches ? 0 : time - start,
          advanceSprites,
          densityRef.current
        )
        .then((animated) => {
          drawing = false
          if (redraw || (animated && !motion.matches)) schedule()
        })
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      frame = 0
      redraw = true
      schedule()
    }
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      resume()
    })
    intersection.observe(canvas)
    resume()
    document.addEventListener('visibilitychange', resume)
    motion.addEventListener('change', resume)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      renderer.dispose()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', resume)
      motion.removeEventListener('change', resume)
    }
  }, [bundle])

  const style = {
    width: width * displayScale,
    height: height * displayScale,
    imageRendering: 'pixelated',
  } as const
  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        role="img"
        aria-label={label}
        data-map-canvas
        className="block max-w-none"
        style={style}
      />
      <canvas
        ref={particleRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 block max-w-none"
        style={style}
      />
      <canvas
        ref={secretRef}
        width={width}
        height={height}
        aria-hidden
        data-secret-overlay
        data-secret-regions={overlay.regions.length}
        className="secret-fade pointer-events-none absolute top-0 left-0 block max-w-none"
        style={style}
      />
    </>
  )
}
