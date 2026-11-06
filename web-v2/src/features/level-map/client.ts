// Level maps from the map worker (./worker.ts). Replies and decoded textures
// are cached, so reopening a map or toggling secrets does not replay it.
import type { LevelMapRequest, MapBundle, MapWorkerResponse } from './types'

/**
 * Main floors `level_map` draws (`levelMaps.supportedDepths` in
 * `engine_info`; the engine constants test checks the copy).
 */
export const MAP_DEPTHS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24,
]

/** Depths whose quest branch `level_map` draws (`levelMaps.branchDepths`). */
export const MAP_BRANCH_DEPTHS: readonly number[] = [12, 13, 14, 17, 18, 19]

export function hasLevelMap(depth: number, branch = 0): boolean {
  return (branch === 0 ? MAP_DEPTHS : MAP_BRANCH_DEPTHS).includes(depth)
}

/** The canonical request text; equal requests share one cache entry. */
export function mapRequestJson(request: LevelMapRequest): string {
  return JSON.stringify({
    seed: request.seed,
    depth: request.depth,
    branch: request.branch ?? 0,
    challenges: [...new Set(request.challenges)].sort(),
    trinket: request.selectedTrinket ?? 'none',
  })
}

const CACHE_SIZE = 8
const TIMEOUT_MS = 30_000

interface Pending {
  resolve: (bundle: MapBundle) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, Pending>()
const cache = new Map<string, Promise<MapBundle>>()
const textures = new Map<string, Promise<ImageBitmap>>()

const asError = (reason: unknown) =>
  reason instanceof Error ? reason : new Error(String(reason))

function resetWorker(error: Error) {
  worker?.terminate()
  worker = undefined
  for (const request of pending.values()) {
    clearTimeout(request.timeout)
    request.reject(error)
  }
  pending.clear()
  cache.clear()
}

/** Decodes each asset once per revision; a failed decode is retried next time. */
function decodeTexture(sha256: string, png: ArrayBuffer): Promise<ImageBitmap> {
  let decoded = textures.get(sha256)
  if (!decoded) {
    decoded = createImageBitmap(new Blob([png], { type: 'image/png' }))
    textures.set(sha256, decoded)
    decoded.catch(() => textures.delete(sha256))
  }
  return decoded
}

async function answer(data: MapWorkerResponse) {
  const request = pending.get(data.id)
  if (!request) return
  pending.delete(data.id)
  clearTimeout(request.timeout)
  if ('error' in data) {
    request.reject(new Error(data.error))
    return
  }
  try {
    const images = await Promise.all(
      data.assets.map(async ({ id, png }) => {
        const asset = data.map.assets.find((entry) => entry.id === id)
        if (!asset) throw new Error(`The map lists no asset ${id}.`)
        return [id, await decodeTexture(asset.sha256, png)] as const
      })
    )
    request.resolve({ map: data.map, textures: new Map(images) })
  } catch (error) {
    request.reject(asError(error))
  }
}

function getWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  })
  created.onerror = (event) => {
    event.preventDefault?.()
    resetWorker(new Error('The map engine stopped. Try opening the map again.'))
  }
  created.onmessageerror = () =>
    resetWorker(
      new Error('The map engine returned unreadable data. Please try again.')
    )
  created.onmessage = ({ data }: MessageEvent<MapWorkerResponse>) =>
    void answer(data)
  worker = created
  return created
}

/** One map with its decoded textures; the last few stay cached. */
export function requestLevelMap(input: LevelMapRequest): Promise<MapBundle> {
  const key = mapRequestJson(input)
  const existing = cache.get(key)
  if (existing) {
    // Most recently used last.
    cache.delete(key)
    cache.set(key, existing)
    return existing
  }
  const promise = new Promise<MapBundle>((resolve, reject) => {
    const active = getWorker()
    const id = ++nextId
    const timeout = setTimeout(
      () => resetWorker(new Error('The map took too long. Please try again.')),
      TIMEOUT_MS
    )
    pending.set(id, { resolve, reject, timeout })
    try {
      active.postMessage({ id, requestJson: key })
    } catch (error) {
      clearTimeout(timeout)
      pending.delete(id)
      reject(asError(error))
    }
  })
  cache.set(key, promise)
  while (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  promise.catch(() => {
    if (cache.get(key) === promise) cache.delete(key)
  })
  return promise
}
