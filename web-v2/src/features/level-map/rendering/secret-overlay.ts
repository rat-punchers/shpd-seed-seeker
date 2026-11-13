import type { MapBundle } from '../types'
import { type MapCanvas, makeMapCanvas, mapContext } from './canvas'
import { drawLevelMap } from './render'

/**
 * The floor before searching, laid over the revealed floor: only the pixels
 * that differ are kept, so secret rooms, doors, traps and concealed entities
 * can fade in and out while everything else stays untouched.
 */
export interface SecretOverlay {
  /** Concealed pixels; transparent wherever both views agree. */
  image: MapCanvas
  /** Touching changed cells, revealed together when one of them is inspected. */
  regions: number[][]
  /** Cell index → region index. */
  regionOf: Map<number, number>
}

const overlays = new WeakMap<MapBundle, SecretOverlay>()

export function secretOverlay(bundle: MapBundle): SecretOverlay {
  let overlay = overlays.get(bundle)
  if (!overlay) {
    overlay = buildSecretOverlay(bundle)
    overlays.set(bundle, overlay)
  }
  return overlay
}

export function buildSecretOverlay(
  bundle: MapBundle,
  makeCanvas: () => MapCanvas = makeMapCanvas
): SecretOverlay {
  const { map } = bundle
  const size = map.scene.tileSize
  const width = map.width * size
  const height = map.height * size
  const draw = (revealSecrets: boolean) => {
    const canvas = makeCanvas()
    canvas.width = width
    canvas.height = height
    const context = mapContext(canvas)
    drawLevelMap(context, bundle, 0, revealSecrets)
    return { canvas, context }
  }
  const revealed = draw(true).context.getImageData(0, 0, width, height).data
  const concealed = draw(false)
  const image = concealed.context.getImageData(0, 0, width, height)
  const pixels = image.data
  const changed = new Set<number>()
  for (let pixel = 0; pixel < width * height; pixel++) {
    const i = pixel * 4
    if (
      pixels[i] === revealed[i] &&
      pixels[i + 1] === revealed[i + 1] &&
      pixels[i + 2] === revealed[i + 2] &&
      pixels[i + 3] === revealed[i + 3]
    ) {
      pixels[i + 3] = 0
    } else {
      const x = Math.floor((pixel % width) / size)
      const y = Math.floor(Math.floor(pixel / width) / size)
      changed.add(y * map.width + x)
    }
  }
  concealed.context.putImageData(image, 0, 0)

  const regionOf = new Map<number, number>()
  const regions: number[][] = []
  for (const start of changed) {
    if (regionOf.has(start)) continue
    const region = regions.length
    const cells: number[] = []
    const queue = [start]
    regionOf.set(start, region)
    while (queue.length > 0) {
      const cell = queue.pop() as number
      cells.push(cell)
      const x = cell % map.width
      for (const dy of [-1, 0, 1]) {
        for (const dx of [-1, 0, 1]) {
          if (x + dx < 0 || x + dx >= map.width) continue
          const next = cell + dy * map.width + dx
          if (changed.has(next) && !regionOf.has(next)) {
            regionOf.set(next, region)
            queue.push(next)
          }
        }
      }
    }
    regions.push(cells)
  }
  return { image: concealed.canvas, regions, regionOf }
}

/** Draws the overlay, leaving out the region holding `focusCell`. */
export function paintSecretOverlay(
  context: CanvasRenderingContext2D,
  overlay: SecretOverlay,
  columns: number,
  tileSize: number,
  focusCell: number | null
) {
  const { width, height } = context.canvas
  context.clearRect(0, 0, width, height)
  context.drawImage(overlay.image, 0, 0)
  const region =
    focusCell === null ? undefined : overlay.regionOf.get(focusCell)
  if (region === undefined) return
  for (const cell of overlay.regions[region] ?? []) {
    context.clearRect(
      (cell % columns) * tileSize,
      Math.floor(cell / columns) * tileSize,
      tileSize,
      tileSize
    )
  }
}
