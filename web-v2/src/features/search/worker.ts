/// <reference lib="webworker" />
// Scans seed ranges and re-verifies seed sets off the main thread. Load with
// `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.

import init, {
  filter_seeds,
  SearchSession,
} from '../../engine/pkg/seedfinder.js'
import type { SearchAdvance } from '../../engine/types'
import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol'

const context = self as unknown as DedicatedWorkerGlobalScope
// Small enough that even a slow worker surfaces progress several times a
// second; posts are still rate-limited to one per 100ms below.
const CHUNK = 256
let activeSession = 0
let stopRequested = false
const ready = init({
  module_or_path: new URL(
    '../../engine/pkg/seedfinder_bg.wasm',
    import.meta.url
  ),
})
const post = (message: SearchWorkerResponse) => context.postMessage(message)
const yieldToMessages = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

async function runSearch(
  message: Extract<SearchWorkerRequest, { type: 'search:start' }>
) {
  // activeSession/stopRequested are assigned synchronously in the message
  // handler, so a stop that arrives while the wasm module is still
  // initializing is honored instead of dropped.
  const sessionId = message.sessionId
  await ready
  const scanned = message.segments.map(() => 0)
  let lastPosted = performance.now()
  let pendingMatches: SearchAdvance['matches'] = []
  const flush = () => {
    post({
      type: 'search:progress',
      sessionId,
      scanned: [...scanned],
      matches: pendingMatches,
    })
    pendingMatches = []
  }
  const active = () => !stopRequested && activeSession === sessionId
  try {
    for (const [segmentIndex, segment] of message.segments.entries()) {
      if (!active()) break
      const scannedOf = () => scanned[segmentIndex] ?? 0
      while (
        segment.startSeed + scannedOf() < segment.endSeedExclusive &&
        active()
      ) {
        const offset = scannedOf()
        const search = new SearchSession(
          message.queryJson,
          segment.startSeed + offset,
          segment.endSeedExclusive
        )
        try {
          while (active()) {
            const advance = JSON.parse(search.advance(CHUNK)) as SearchAdvance
            scanned[segmentIndex] = offset + advance.tested
            pendingMatches.push(...advance.matches)
            const now = performance.now()
            if (now - lastPosted >= 100) {
              flush()
              lastPosted = now
            }
            // "completed" also fires when the session hits its own result cap
            // before reaching the end of the segment; the per-segment scanned
            // count keeps the untested tail attributable either way.
            if (advance.state === 'completed') break
            await yieldToMessages()
          }
        } finally {
          search.free()
        }
        flush()
        await yieldToMessages()
        if (scannedOf() === offset) break
      }
    }
    if (activeSession !== sessionId) return
    flush()
    if (stopRequested) post({ type: 'search:stopped', sessionId, scanned })
    else post({ type: 'search:done', sessionId, scanned })
  } catch (error) {
    // Preserve discoveries made since the last progress report.
    flush()
    post({
      type: 'search:error',
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function runFilter(
  message: Extract<SearchWorkerRequest, { type: 'filter' }>
) {
  await ready
  try {
    post({
      type: 'filter:result',
      requestId: message.requestId,
      resultJson: filter_seeds(
        message.queryJson,
        new Float64Array(message.seeds),
        message.trinkets ? JSON.stringify(message.trinkets) : undefined,
        message.baseQueryJson
      ),
    })
  } catch (error) {
    post({
      type: 'filter:error',
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

context.addEventListener(
  'message',
  (event: MessageEvent<SearchWorkerRequest>) => {
    const message = event.data
    if (message.type === 'search:start') {
      activeSession = message.sessionId
      stopRequested = false
      void runSearch(message)
    }
    if (message.type === 'search:stop' && message.sessionId === activeSession)
      stopRequested = true
    if (message.type === 'filter') void runFilter(message)
  }
)
