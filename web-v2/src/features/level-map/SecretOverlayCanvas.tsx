import { useLayoutEffect, useRef } from 'react'
import type { SecretCrop } from './rendering/secret-overlay'

export function SecretOverlayCanvas({
  crop,
  columns,
  tileSize,
  focusCell,
}: {
  crop: SecretCrop
  columns: number
  tileSize: number
  focusCell: number | null
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const region = focusCell === null ? undefined : crop.regionOf.get(focusCell)

  useLayoutEffect(() => {
    const context = ref.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, crop.image.width, crop.image.height)
    context.drawImage(crop.image, 0, 0)
    for (const cell of region ?? []) {
      context.clearRect(
        (cell % columns) * tileSize - crop.x,
        Math.floor(cell / columns) * tileSize - crop.y,
        tileSize,
        tileSize
      )
    }
  }, [columns, crop, region, tileSize])

  return (
    <canvas
      ref={ref}
      aria-hidden
      data-secret-overlay
      width={crop.image.width}
      height={crop.image.height}
      style={{ left: crop.x, top: crop.y }}
      className="secret-fade pointer-events-none absolute block"
    />
  )
}
