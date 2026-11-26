import type { MapBundle, MapLayer, Rectangle } from '../types'
import { type MapCanvas, makeMapCanvas, mapContext } from './canvas'
import { drawCommand } from './render'
import { changedLayerPairs } from './scene-layer-diff'

export interface SecretCrop {
  firstCell: number
  x: number
  y: number
  image: MapCanvas
  /** The changed tiles revealed together when any one of them is inspected. */
  regionOf: ReadonlyMap<number, number[]>
}

const overlays = new WeakMap<MapBundle, SecretCrop[]>()

export function secretOverlay(bundle: MapBundle): SecretCrop[] {
  let overlay = overlays.get(bundle)
  if (!overlay) {
    overlay = buildSecretOverlay(bundle)
    overlays.set(bundle, overlay)
  }
  return overlay
}

function connectedCells(cells: Set<number>, columns: number): number[][] {
  const remaining = new Set(cells)
  const regions: number[][] = []
  for (const start of cells) {
    if (!remaining.delete(start)) continue
    const region = [start]
    for (const cell of region) {
      const x = cell % columns
      for (const dy of [-1, 0, 1]) {
        for (const dx of [-1, 0, 1]) {
          if (x + dx < 0 || x + dx >= columns) continue
          const next = cell + dy * columns + dx
          if (remaining.delete(next)) region.push(next)
        }
      }
    }
    regions.push(region)
  }
  return regions
}

function changedTiles(bundle: MapBundle): Set<number> {
  const { width, height, scene } = bundle.map
  const { tileSize, layers, concealedLayers, sprites } = scene
  const changed = new Set<number>()
  for (const [a, b] of changedLayerPairs(layers, concealedLayers)) {
    const count = Math.max(a?.cells.length ?? 0, b?.cells.length ?? 0)
    for (let cell = 0; cell < count; cell++) {
      const shown = a?.cells[cell] ?? null
      const hidden = b?.cells[cell] ?? null
      if (shown === hidden) continue
      const x = cell % width
      const y = Math.floor(cell / width)
      for (const sprite of [shown, hidden]) {
        if (sprite == null) continue
        // Include overhangs and shadows from either view, which can cross tiles.
        for (const draw of sprites[sprite]?.frames[0] ?? []) {
          const [dx, dy, w, h] = draw.destination
          const left = Math.max(0, x + Math.floor(dx / tileSize))
          const top = Math.max(0, y + Math.floor(dy / tileSize))
          const right = Math.min(width, x + Math.ceil((dx + w) / tileSize))
          const bottom = Math.min(height, y + Math.ceil((dy + h) / tileSize))
          for (let row = top; row < bottom; row++) {
            for (let col = left; col < right; col++) {
              changed.add(row * width + col)
            }
          }
        }
      }
    }
  }
  return changed
}

function cropBounds(
  cells: number[],
  columns: number,
  tileSize: number
): Rectangle {
  let left = columns
  let right = 0
  let top = Number.POSITIVE_INFINITY
  let bottom = 0
  for (const cell of cells) {
    const x = cell % columns
    const y = Math.floor(cell / columns)
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x + 1)
    bottom = Math.max(bottom, y + 1)
  }
  return [
    left * tileSize,
    top * tileSize,
    (right - left) * tileSize,
    (bottom - top) * tileSize,
  ]
}

function rasterizeCrops(
  bundle: MapBundle,
  layers: MapLayer[],
  bounds: Rectangle[],
  makeCanvas: () => MapCanvas
) {
  const { width: columns, scene } = bundle.map
  const { tileSize, sprites } = scene
  const targets = bounds.map(([x, y, width, height]) => {
    const canvas = makeCanvas()
    canvas.width = width
    canvas.height = height
    const context = mapContext(canvas)
    context.imageSmoothingEnabled = false
    context.fillStyle = '#000'
    context.fillRect(0, 0, width, height)
    return { canvas, context, x, y, right: x + width, bottom: y + height }
  })
  for (const layer of layers) {
    for (const { context } of targets) {
      context.globalCompositeOperation =
        layer.blend === 'add' ? 'lighter' : 'source-over'
    }
    layer.cells.forEach((index, cell) => {
      if (index == null) return
      const x = (cell % columns) * tileSize
      const y = Math.floor(cell / columns) * tileSize
      for (const draw of sprites[index]?.frames[0] ?? []) {
        const [dx, dy, w, h] = draw.destination
        const left = x + dx
        const top = y + dy
        for (const target of targets) {
          if (
            left < target.right &&
            top < target.bottom &&
            left + w > target.x &&
            top + h > target.y
          ) {
            drawCommand(
              target.context,
              bundle,
              draw,
              x - target.x,
              y - target.y
            )
          }
        }
      }
    })
  }
  return targets
}

export function buildSecretOverlay(
  bundle: MapBundle,
  makeCanvas: () => MapCanvas = makeMapCanvas
): SecretCrop[] {
  const { width: columns, scene } = bundle.map
  const { tileSize } = scene
  const candidates = connectedCells(changedTiles(bundle), columns)
  if (!candidates.length) return []
  const bounds = candidates.map((cells) => cropBounds(cells, columns, tileSize))
  const shown = rasterizeCrops(bundle, scene.layers, bounds, makeCanvas)
  const hidden = rasterizeCrops(
    bundle,
    scene.concealedLayers,
    bounds,
    makeCanvas
  )
  return hidden.flatMap(({ canvas, context, x, y }, index) => {
    const { width, height } = canvas
    const revealed = shown[index]?.context.getImageData(0, 0, width, height)
    if (!revealed) return []
    const concealed = context.getImageData(0, 0, width, height)
    const pixels = new Uint32Array(concealed.data.buffer)
    const reference = new Uint32Array(revealed.data.buffer)
    const cells = new Set(candidates[index])
    const changed = new Set<number>()
    for (let top = 0; top < height; top += tileSize) {
      for (let left = 0; left < width; left += tileSize) {
        const cell = ((y + top) / tileSize) * columns + (x + left) / tileSize
        // Bounding rectangles can overlap, but each tile belongs to one crop.
        const owned = cells.has(cell)
        let differs = false
        for (let row = top; row < top + tileSize; row++) {
          for (let col = left; col < left + tileSize; col++) {
            const pixel = row * width + col
            if (!owned || pixels[pixel] === reference[pixel]) pixels[pixel] = 0
            else differs = true
          }
        }
        if (differs) changed.add(cell)
      }
    }
    const firstCell = changed.values().next().value
    if (firstCell === undefined) return []
    context.putImageData(concealed, 0, 0)
    const regionOf = new Map<number, number[]>()
    for (const region of connectedCells(changed, columns)) {
      for (const cell of region) regionOf.set(cell, region)
    }
    return [{ firstCell, x, y, image: canvas, regionOf }]
  })
}
