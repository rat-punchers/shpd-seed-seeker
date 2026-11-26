import type { MapBundle } from '../types'
import { type EffectsView, sameEffectsView } from './effects-view'
import type {
  EffectsSurface,
  MapRenderFrame,
  RenderRequest,
  RenderResponse,
} from './render-worker'
import { createMapSceneRenderer } from './scene-renderer'

/** One frame in flight. Fresh DOM canvases let Strict Mode and failover reattach. */
export function createMapFrameRenderer(
  host: HTMLElement,
  bundle: MapBundle,
  label: string
) {
  const { map } = bundle
  const width = map.width * map.scene.tileSize
  const height = map.height * map.scene.tileSize
  const hasEffects = (map.scene.emitters?.length ?? 0) > 0
  function mount() {
    const scenery = document.createElement('canvas')
    scenery.width = width
    scenery.height = height
    scenery.className = 'block size-full'
    scenery.setAttribute('role', 'img')
    scenery.setAttribute('aria-label', label)
    scenery.dataset.mapCanvas = ''
    const effects = Array.from({ length: hasEffects ? 2 : 0 }, () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      canvas.className = 'pointer-events-none absolute block'
      canvas.setAttribute('aria-hidden', 'true')
      canvas.dataset.mapEffects = ''
      canvas.style.visibility = 'hidden'
      return canvas
    })
    host.replaceChildren(scenery, ...effects)
    return { scenery, effects }
  }

  let surfaces = mount()
  let worker: Worker | undefined
  let fallback: ReturnType<typeof createMapSceneRenderer> | undefined
  let disposed = false
  let lastFrame: MapRenderFrame | undefined
  let shownEffects: { view: EffectsView; surface: EffectsSurface } | null = null
  let pending:
    | {
        frame: MapRenderFrame
        surface: EffectsSurface
        resolve: (animated: boolean) => void
        timeout: ReturnType<typeof setTimeout>
      }
    | undefined

  function drawFallback(
    frame: MapRenderFrame,
    surface: EffectsSurface
  ): boolean {
    if (!fallback) {
      const scenery = surfaces.scenery.getContext('2d')
      if (!scenery) return false
      fallback = createMapSceneRenderer(scenery, bundle)
    }
    const effects = surfaces.effects[surface]?.getContext('2d') ?? null
    const animated = fallback.draw(frame, effects)
    publishEffects(frame.effects, surface)
    return animated
  }

  const takePending = () => {
    const current = pending
    pending = undefined
    if (current) clearTimeout(current.timeout)
    return current
  }

  function publishEffects(view: EffectsView | null, surface: EffectsSurface) {
    if (!hasEffects) return
    const target = surfaces.effects[surface]
    if (!target) return
    const { style } = target
    const previous = shownEffects
    if (previous?.surface === surface && sameEffectsView(view, previous.view))
      return
    const position = (value: number, span: number) => `${(100 * value) / span}%`
    if (view) {
      const [x, y, w, h] = view.bounds
      style.left = position(x, width)
      style.top = position(y, height)
      style.width = position(w, width)
      style.height = position(h, height)
    }
    style.visibility = view ? 'visible' : 'hidden'
    if (previous && previous.surface !== surface) {
      const outgoing = surfaces.effects[previous.surface]
      if (outgoing) outgoing.style.visibility = 'hidden'
    }
    shownEffects = view ? { view, surface } : null
  }

  function failover(event?: ErrorEvent) {
    event?.preventDefault()
    if (!worker || disposed) return
    worker.terminate()
    worker = undefined
    // A transferred canvas cannot accept a main-thread context afterwards.
    surfaces = mount()
    shownEffects = null
    const current = takePending()
    if (current) current.resolve(drawFallback(current.frame, current.surface))
    else if (lastFrame) drawFallback(lastFrame, 0)
  }

  if (
    typeof Worker !== 'undefined' &&
    typeof surfaces.scenery.transferControlToOffscreen === 'function'
  ) {
    try {
      const renderWorker = new Worker(
        new URL('./render-worker.ts', import.meta.url),
        { type: 'module' }
      )
      worker = renderWorker
      renderWorker.onerror = failover
      renderWorker.onmessageerror = () => failover()
      renderWorker.onmessage = ({ data }: MessageEvent<RenderResponse>) => {
        if (disposed || worker !== renderWorker) return
        if (data.kind === 'error') {
          failover()
          return
        }
        const current = takePending()
        if (!current) return
        publishEffects(current.frame.effects, current.surface)
        current.resolve(data.animated)
      }
      const scenery = surfaces.scenery.transferControlToOffscreen()
      const effects = surfaces.effects.map((canvas) =>
        canvas.transferControlToOffscreen()
      )
      renderWorker.postMessage(
        { kind: 'init', bundle, scenery, effects } satisfies RenderRequest,
        [scenery, ...effects]
      )
    } catch {
      failover()
    }
  }

  return {
    draw(frame: MapRenderFrame): Promise<boolean> {
      lastFrame = frame
      const renderWorker = worker
      // A new crop is drawn offscreen so the visible crop retains its
      // bitmap and position until the replacement is ready.
      const surface =
        !shownEffects || sameEffectsView(frame.effects, shownEffects.view)
          ? (shownEffects?.surface ?? 0)
          : shownEffects.surface === 0
            ? 1
            : 0
      if (!renderWorker) return Promise.resolve(drawFallback(frame, surface))
      return new Promise((resolve) => {
        pending = {
          frame,
          surface,
          resolve,
          timeout: setTimeout(failover, 5000),
        }
        try {
          renderWorker.postMessage({
            kind: 'draw',
            frame,
            surface,
          } satisfies RenderRequest)
        } catch {
          failover()
        }
      })
    },
    dispose() {
      disposed = true
      worker?.terminate()
      takePending()?.resolve(false)
      host.replaceChildren()
    },
  }
}
