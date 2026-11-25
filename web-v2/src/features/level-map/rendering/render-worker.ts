import type { MapBundle } from '../types'
import type { EffectsView } from './effects-view'
import { createMapSceneRenderer } from './scene-renderer'

export interface MapRenderFrame {
  elapsed: number
  advanceSprites: boolean
  effects: EffectsView | null
}

export type EffectsSurface = 0 | 1

export type RenderRequest =
  | {
      kind: 'init'
      bundle: MapBundle
      scenery: OffscreenCanvas
      effects: OffscreenCanvas[]
    }
  | { kind: 'draw'; frame: MapRenderFrame; surface: EffectsSurface }
export type RenderResponse =
  | { kind: 'frame'; animated: boolean }
  | { kind: 'error' }

const fail = () => self.postMessage({ kind: 'error' } satisfies RenderResponse)
let renderer: ReturnType<typeof createMapSceneRenderer> | undefined
let effects: (OffscreenCanvasRenderingContext2D | null)[] = []
self.onmessage = ({ data }: MessageEvent<RenderRequest>) => {
  try {
    if (data.kind === 'init') {
      const scenery = data.scenery.getContext('2d')
      effects = data.effects.map((canvas) => canvas.getContext('2d'))
      if (!scenery || effects.some((context) => !context))
        throw new Error('No 2D context')
      data.scenery.addEventListener('contextlost', fail)
      for (const canvas of data.effects)
        canvas.addEventListener('contextlost', fail)
      renderer = createMapSceneRenderer(scenery, data.bundle)
    } else {
      if (!renderer) throw new Error('Map renderer has not started')
      const animated = renderer.draw(data.frame, effects[data.surface] ?? null)
      self.postMessage({ kind: 'frame', animated } satisfies RenderResponse)
    }
  } catch {
    fail()
  }
}
