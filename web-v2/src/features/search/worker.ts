/// <reference lib="webworker" />
// Scans seed ranges and re-verifies seed sets off the main thread. Load with
// `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.

import init, {
  filter_seeds,
  SearchSession,
} from '../../engine/pkg/seedfinder.js'
import type { SearchAdvance } from '../../engine/types'
import { FIRST_CHUNK, nextChunk } from './chunk'
import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol'

const context = self as unknown as DedicatedWorkerGlobalScope
let activeSession = 0
let stopRequested = false
const ready = init({
  module_or_path: new URL(
    '../../engine/pkg/seedfinder_bg.wasm',
    import.meta.url
  ),
})
const post = (message: SearchWorkerResponse) => context.postMessage(message)
// A MessageChannel round trip lets a queued stop in without the 4ms clamp
// nested timeouts get.
const channel = new MessageChannel()
const yielded: (() => void)[] = []
channel.port1.onmessage = () => yielded.shift()?.()
const yieldToMessages = () =>
  new Promise<void>((resolve) => {
    yielded.push(resolve)
    channel.port2.postMessage(null)
  })

async function runSearch(
  message: Extract<SearchWorkerRequest, { type: 'search:start' }>
) {
  // activeSession/stopRequested are assigned synchronously in the message
  // handler, so a stop that arrives while the wasm module is still
  // initializing is honored instead of dropped.
  const sessionId = message.sessionId
  await ready
  const scanned = message.segments.map(() => 0)
  // The first chunk reports at once, so progress shows without a delay.
  let lastPosted = Number.NEGATIVE_INFINITY
  let chunk = FIRST_CHUNK
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
          let tested = 0
          while (active()) {
            const began = performance.now()
            const advance = JSON.parse(search.advance(chunk)) as SearchAdvance
            const now = performance.now()
            chunk = nextChunk(chunk, advance.tested - tested, now - began)
            tested = advance.tested
            scanned[segmentIndex] = offset + advance.tested
            pendingMatches.push(...advance.matches)
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
