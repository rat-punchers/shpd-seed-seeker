import type { MapBundle, MapDraw } from '../types'
import { type MapCanvas, makeMapCanvas, mapContext } from './canvas'

const tinted = new WeakMap<MapBundle, Map<string, CanvasImageSource>>()
type GlowingTexture = { image: MapCanvas; amount: number }
const glowing = new WeakMap<MapBundle, Map<string, GlowingTexture>>()

/** Mix RGB inside a small sprite buffer, preserving even translucent source pixels. */
export function glowTexture(
  bundle: MapBundle,
  draw: Extract<MapDraw, { kind: 'blit' }>,
  amount: number
): CanvasImageSource {
  const glow = draw.glow
  if (!glow) return drawTexture(bundle, draw)
  let cache = glowing.get(bundle)
  if (!cache) {
    cache = new Map()
    glowing.set(bundle, cache)
  }
  const key = JSON.stringify([draw.asset, draw.source, draw.tint, glow.color])
  let entry = cache.get(key)
  const [, , width, height] = draw.source
  if (!entry) {
    const canvas = makeMapCanvas()
    canvas.width = width
    canvas.height = height
    entry = { image: canvas, amount: -1 }
    cache.set(key, entry)
  }
  if (entry.amount !== amount) {
    const context = mapContext(entry.image)
    context.globalAlpha = 1
    context.globalCompositeOperation = 'copy'
    context.drawImage(
      drawTexture(bundle, draw),
      ...draw.source,
      0,
      0,
      width,
      height
    )
    context.globalCompositeOperation = 'source-atop'
    context.globalAlpha = amount
    context.fillStyle = `rgb(${glow.color.join(',')})`
    context.fillRect(0, 0, width, height)
    entry.amount = amount
  }
  return entry.image
}
/** A decoded map texture; the map client decodes every listed asset. */
export function mapTexture(bundle: MapBundle, id: string): ImageBitmap {
  const texture = bundle.textures.get(id)
  if (!texture) throw new Error(`The map has no texture ${id}.`)
  return texture
}

/** The game multiplies RGB independently of source alpha (including black shadows). */
export function drawTexture(
  bundle: MapBundle,
  draw: Extract<MapDraw, { kind: 'blit' }>,
  makeCanvas = makeMapCanvas
): CanvasImageSource {
  const original = mapTexture(bundle, draw.asset)
  if (!draw.tint) return original
  let cache = tinted.get(bundle)
  if (!cache) {
    cache = new Map()
    tinted.set(bundle, cache)
  }
  const key = `${draw.asset}:${draw.tint.join(',')}`
  let image = cache.get(key)
  if (!image) {
    const canvas = makeCanvas()
    const asset = bundle.map.assets.find((entry) => entry.id === draw.asset)
    if (!asset) throw new Error(`The map lists no asset ${draw.asset}.`)
    canvas.width = asset.width
    canvas.height = asset.height
    const context = mapContext(canvas)
    context.fillStyle = `rgb(${draw.tint.join(',')})`
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = 'multiply'
    context.drawImage(original, 0, 0)
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(original, 0, 0)
    image = canvas
    cache.set(key, image)
  }
  return image
}
