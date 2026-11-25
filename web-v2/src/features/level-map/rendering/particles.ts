import type { MapBundle, MapEmitter } from '../types'
import {
  type MapCanvas,
  type MapContext,
  makeMapCanvas,
  mapContext,
} from './canvas'
import {
  clipRectangle,
  type EffectsView,
  sameEffectsView,
} from './effects-view'
import { emitterBounds, particleState } from './particle-state'
import { drawCommand } from './render'
import { drawTexture } from './textures'

/** Separate display-rate surface. Only particle bounds are copied from scenery,
 * providing the destination pixels required by the game's additive blending. */
export function createMapParticleRenderer(
  scenery: MapCanvas,
  bundle: MapBundle
) {
  const { map } = bundle,
    size = map.scene.tileSize
  const width = map.width * size,
    height = map.height * size
  const emitters = map.scene.emitters ?? []
  const wind = emitters.filter((emitter) => emitter.clipToChasm)
  // Clip complete wind trajectories so they cannot drift onto floors or into
  // the outer void.
  const chasms = wind.length ? new Path2D() : null
  for (const emitter of wind)
    chasms?.rect(
      (emitter.cell % map.width) * size,
      Math.floor(emitter.cell / map.width) * size,
      size,
      size
    )
  const entries = emitters.map((emitter) => ({
    emitter,
    bounds: emitterBounds(emitter, map.width, size),
    texture:
      emitter.image.kind === 'blit' ? drawTexture(bundle, emitter.image) : null,
  }))
  const makeMask = (names: string[]) => {
    const mask = makeMapCanvas()
    mask.width = width
    mask.height = height
    const target = mapContext(mask)
    target.imageSmoothingEnabled = false
    for (const layer of map.scene.layers.filter((layer) =>
      names.includes(layer.name)
    )) {
      layer.cells.forEach((sprite, cell) => {
        if (sprite === null) return
        for (const draw of map.scene.sprites[sprite]?.frames[0] ?? [])
          drawCommand(
            target,
            bundle,
            draw,
            (cell % map.width) * size,
            Math.floor(cell / map.width) * size
          )
      })
    }
    return mask
  }
  const darkness = makeMask(['darkness'])
  const walls = makeMask(['raised', 'walls', 'room_walls', 'boss_walls'])
  let previous: EffectsView | null = null
  let previousContext: MapContext | null = null
  const select = (view: EffectsView) =>
    entries.flatMap((entry) => {
      const region = clipRectangle(entry.bounds, view.bounds)
      return region ? [{ ...entry, region }] : []
    })
  let visible: ReturnType<typeof select> = []
  return {
    draw(context: MapContext, elapsed: number, view: EffectsView): boolean {
      const changed =
        previousContext !== context || !sameEffectsView(previous, view)
      const [left, top, w, h] = view.bounds
      if (changed) {
        previous = view
        previousContext = context
        visible = select(view)
        const pixelWidth = Math.round(w * view.density)
        const pixelHeight = Math.round(h * view.density)
        if (context.canvas.width !== pixelWidth)
          context.canvas.width = pixelWidth
        if (context.canvas.height !== pixelHeight)
          context.canvas.height = pixelHeight
        context.resetTransform()
        context.clearRect(0, 0, pixelWidth, pixelHeight)
      }
      if (visible.length === 0) return false
      const scaleX = context.canvas.width / w
      const scaleY = context.canvas.height / h
      context.save()
      context.setTransform(scaleX, 0, 0, scaleY, -left * scaleX, -top * scaleY)
      context.imageSmoothingEnabled = false
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      // Copy all backgrounds before drawing any emitter; overlaps retain particles.
      for (const {
        region: [x, y, w, h],
      } of visible) {
        context.clearRect(x, y, w, h)
        context.drawImage(scenery, x, y, w, h, x, y, w, h)
      }
      const drawEmitter = (
        emitter: MapEmitter,
        texture: CanvasImageSource | null
      ) => {
        const ox = (emitter.cell % map.width) * size,
          oy = Math.floor(emitter.cell / map.width) * size
        const image = emitter.image,
          w = image.destination[2],
          h = image.destination[3]
        context.globalCompositeOperation =
          emitter.blend === 'add' ? 'lighter' : 'source-over'
        for (const particle of emitter.particles) {
          const state = particleState(emitter, particle, elapsed)
          if (
            !state ||
            state.scale <= 0 ||
            state.scaleX <= 0 ||
            state.scaleY <= 0 ||
            state.alpha <= 0
          )
            continue
          context.save()
          context.translate(ox + state.x, oy + state.y)
          if (state.angle) context.rotate(state.angle)
          context.scale(state.scale * state.scaleX, state.scale * state.scaleY)
          context.globalAlpha =
            state.alpha *
            (image.kind === 'blit'
              ? (image.opacity ?? 255) / 255
              : image.rgba[3] / 255)
          if (image.kind === 'blit') {
            if (texture)
              context.drawImage(texture, ...image.source, -w / 2, -h / 2, w, h)
          } else {
            context.fillStyle = `rgb(${image.rgba.slice(0, 3).join(',')})`
            context.fillRect(-w / 2, -h / 2, w, h)
          }
          context.restore()
        }
      }
      const eraseMask = (mask: MapCanvas) => {
        context.globalAlpha = 1
        context.globalCompositeOperation = 'destination-out'
        for (const {
          region: [x, y, w, h],
        } of visible)
          context.drawImage(mask, x, y, w, h, x, y, w, h)
      }
      if (chasms) {
        context.save()
        context.clip(chasms)
        visible.forEach(({ emitter, texture }) => {
          if (emitter.clipToChasm) drawEmitter(emitter, texture)
        })
        context.restore()
      }
      visible.forEach(({ emitter, texture }) => {
        if (emitter.wallMask && !emitter.clipToChasm)
          drawEmitter(emitter, texture)
      })
      eraseMask(walls)
      visible.forEach(({ emitter, texture }) => {
        if (!emitter.wallMask && !emitter.clipToChasm)
          drawEmitter(emitter, texture)
      })
      eraseMask(darkness)
      context.restore()
      return true
    },
  }
}
