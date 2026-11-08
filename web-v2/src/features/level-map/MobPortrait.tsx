import { useEffect, useRef } from 'react'
import { useFilmFrame } from '../../shared/ui/use-film-frame'
import type { MapBundle, MapMobDetail } from './types'

/** Largest portrait edge in CSS pixels; sprites scale by whole numbers. */
const PORTRAIT = 36

/** A mob's idle film, cut from the map's own atlas. */
export function MobPortrait({
  bundle,
  detail,
}: {
  bundle: MapBundle
  detail: MapMobDetail
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frame = useFilmFrame(detail.frames.length, detail.frameDurationMs)
  const [, , width, height] = detail.frames[0] ?? [0, 0, 16, 16]
  const scale = Math.max(1, Math.floor(PORTRAIT / Math.max(width, height)))
  const texture = bundle.textures.get(detail.asset)

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    const source = detail.frames[frame]
    if (!context || !source || !texture) return
    context.clearRect(0, 0, width, height)
    context.drawImage(texture, ...source, 0, 0, width, height)
  }, [detail, frame, texture, width, height])

  if (!texture) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-mob-portrait
      width={width}
      height={height}
      className="block"
      style={{
        width: width * scale,
        height: height * scale,
        imageRendering: 'pixelated',
      }}
    />
  )
}
