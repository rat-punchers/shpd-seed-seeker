import type { MapFrame } from '../map-view'
import type { Rectangle } from '../types'

export interface EffectsView {
  bounds: Rectangle
  density: number
}

export function visibleEffects(
  frame: MapFrame | null,
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
  dpr: number
): EffectsView | null {
  if (!frame || frame.width <= 0 || frame.height <= 0) return null
  const { zoom, x, y } = frame.view
  // Tile alignment avoids reallocating the surface for every pixel of motion.
  const first = (offset: number) =>
    Math.max(0, (Math.floor(-offset / zoom / tileSize) - 1) * tileSize)
  const last = (offset: number, size: number, limit: number) =>
    Math.min(
      limit,
      (Math.ceil((size - offset) / zoom / tileSize) + 1) * tileSize
    )
  const left = first(x)
  const top = first(y)
  const width = last(x, frame.width, mapWidth) - left
  const height = last(y, frame.height, mapHeight) - top
  if (width <= 0 || height <= 0) return null
  return {
    bounds: [left, top, width, height],
    density: Math.max(1, Math.min(4, zoom * dpr)),
  }
}

export function sameEffectsView(
  a: EffectsView | null,
  b: EffectsView | null
): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.density === b.density &&
      a.bounds.every((value, i) => value === b.bounds[i]))
  )
}

export function clipRectangle(a: Rectangle, b: Rectangle): Rectangle | null {
  const x = Math.max(a[0], b[0])
  const y = Math.max(a[1], b[1])
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - x
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - y
  return w > 0 && h > 0 ? [x, y, w, h] : null
}
