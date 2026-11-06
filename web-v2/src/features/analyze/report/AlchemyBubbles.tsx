import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from './hooks'

/** Source pixels around the pot: bubbles overhang sideways and rise above. */
const PAD_X = 4
const RISE = 24
const TILE = 16
/** The alchemy blob's bubble tint. */
const COLOR = '#c4e8ff'

interface Bubble {
  x: number
  y: number
  speed: number
  life: number
}

function spawn(): Bubble {
  return {
    x: PAD_X + 3 + Math.random() * (TILE - 6),
    y: RISE + TILE - 6,
    speed: 8 + Math.random() * 8,
    life: 1,
  }
}

/**
 * Bubbles rising from an alchemy pot icon, like the map's `Alchemy` blob.
 * Sits on the icon's bottom edge; `scale` matches the icon's pixel scale.
 * Paused off-screen and absent under reduced motion.
 */
export function AlchemyBubbles({ scale }: { scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion()) return
    const bubbles: Bubble[] = []
    let visible = false
    let frame = 0
    let last = 0
    let sinceSpawn = 0

    const draw = (now: number) => {
      const context = canvas.getContext('2d')
      if (!visible || !context) return
      const step = Math.min((now - last) / 1000, 0.1)
      last = now
      sinceSpawn += step
      if (sinceSpawn > 0.35) {
        sinceSpawn = 0
        bubbles.push(spawn())
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = COLOR
      for (const bubble of bubbles) {
        bubble.y -= bubble.speed * step
        bubble.life -= step / 1.4
        context.globalAlpha = Math.max(bubble.life, 0)
        context.fillRect(
          Math.round(bubble.x) * scale,
          Math.round(bubble.y) * scale,
          scale,
          scale
        )
      }
      for (let index = bubbles.length - 1; index >= 0; index--) {
        if ((bubbles[index]?.life ?? 0) <= 0) bubbles.splice(index, 1)
      }
      frame = requestAnimationFrame(draw)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      cancelAnimationFrame(frame)
      if (visible) {
        last = performance.now()
        frame = requestAnimationFrame(draw)
      }
    })
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [scale])

  const width = (TILE + PAD_X * 2) * scale
  const height = (TILE + RISE) * scale
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      width={width}
      height={height}
      className="pointer-events-none absolute bottom-0"
      style={{
        left: -PAD_X * scale,
        width,
        height,
        imageRendering: 'pixelated',
      }}
    />
  )
}
