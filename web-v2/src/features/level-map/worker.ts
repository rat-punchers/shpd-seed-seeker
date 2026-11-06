// Map replay has its own worker, so opening a map cannot stall the report
// or the search. Load with
// `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
import init, {
  level_map,
  level_map_asset,
} from '../../engine/pkg/seedfinder.js'
import type {
  LevelMapDocument,
  MapWorkerRequest,
  MapWorkerResponse,
} from './types'

const ready = init({
  module_or_path: new URL(
    '../../engine/pkg/seedfinder_bg.wasm',
    import.meta.url
  ),
})

self.onmessage = async ({ data }: MessageEvent<MapWorkerRequest>) => {
  try {
    await ready
    const map = JSON.parse(level_map(data.requestJson)) as LevelMapDocument
    if (
      (map.schemaVersion !== 2 && map.schemaVersion !== 3) ||
      map.format !== 'seed-seeker-level-map'
    ) {
      throw new Error('This map needs a newer version of Seed Seeker.')
    }
    const assets = map.assets.map(({ id }) => ({
      id,
      png: level_map_asset(id).slice().buffer,
    }))
    const response: MapWorkerResponse = { id: data.id, map, assets }
    self.postMessage(response, { transfer: assets.map(({ png }) => png) })
  } catch (error) {
    const response: MapWorkerResponse = {
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}
