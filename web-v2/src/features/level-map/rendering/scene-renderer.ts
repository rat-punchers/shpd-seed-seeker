import type { MapBundle } from '../types'
import type { MapContext } from './canvas'
import { createMapParticleRenderer } from './particles'
import { createLevelMapRenderer } from './render'
import type { MapRenderFrame } from './render-worker'

export function createMapSceneRenderer(scenery: MapContext, bundle: MapBundle) {
  const renderer = createLevelMapRenderer(scenery, bundle, true)
  let particles: ReturnType<typeof createMapParticleRenderer> | undefined
  const hasParticles = (bundle.map.scene.emitters?.length ?? 0) > 0
  return {
    draw(
      { elapsed, advanceSprites, effects: view }: MapRenderFrame,
      effects: MapContext | null
    ) {
      renderer.draw(elapsed, advanceSprites)
      if (!effects || !view || !hasParticles) return renderer.animated
      particles ??= createMapParticleRenderer(scenery.canvas, bundle)
      return particles.draw(effects, elapsed, view) || renderer.animated
    },
  }
}
