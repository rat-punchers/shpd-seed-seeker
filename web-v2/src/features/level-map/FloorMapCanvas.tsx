import { useEffect, useRef } from 'react'
import { createMapFrameRenderer } from './rendering/frame-renderer'
import type { MapBundle } from './types'

/** Sprite frames advance at most this often; particles follow the display. */
const SPRITE_FRAME_MS = 50

/**
 * The map's two surfaces: scenery at one canvas pixel per map pixel, and
 * particles at the displayed density. Both are sized by `displayScale` in
 * CSS. Animation pauses off-screen, in a hidden tab, and with reduced
 * motion, which draws the first frame only.
 */
export function FloorMapCanvas({
  bundle,
  secrets,
  displayScale,
  label,
}: {
  bundle: MapBundle
  secrets: boolean
  displayScale: number
  label: string
}) {
  const { map } = bundle
  const width = map.width * map.scene.tileSize
  const height = map.height * map.scene.tileSize
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particleRef = useRef<HTMLCanvasElement>(null)
  const densityRef = useRef(1)
  densityRef.current = Math.max(
    1,
    Math.min(4, displayScale * (window.devicePixelRatio || 1))
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const particleContext = particleRef.current?.getContext('2d')
    if (!canvas || !context || !particleContext) return
    const renderer = createMapFrameRenderer(
      context,
      particleContext,
      bundle,
      secrets
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
  }, [bundle, secrets])

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
        data-secrets={secrets ? 'shown' : 'hidden'}
        className="block max-w-none"
        style={style}
      />
      <canvas
        ref={particleRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 block max-w-none"
        style={style}
      />
    </>
  )
}
