import { formatSeedCode } from '../../engine/wasm'
import { $analyzeRequest } from './handoff'
import { initResultKeys } from './navigation'
import { loadSeedFormatter } from './seed-input'
import type { SeedLink } from './seed-link'
import { openSeed, restoreSessions } from './sessions'

/**
 * Starts Analyze with the startup replay, saved tabs, Find handoffs and J/K.
 * Waits for the linked seed to be formatted before publishing route state.
 */
export async function initAnalyze({
  seed,
  legacySeed,
}: {
  seed?: SeedLink
  legacySeed?: string
}): Promise<() => void> {
  const linked = seed?.seed ?? legacySeed
  let replay: SeedLink | undefined
  if (linked) {
    const formatted = await loadSeedFormatter().then(
      () => formatSeedCode(linked),
      () => linked
    )
    replay = { ...seed, seed: formatted || linked }
  }
  void restoreSessions(replay)

  const take = (request = $analyzeRequest.get()) => {
    if (!request) return
    $analyzeRequest.set(undefined)
    void openSeed(request)
  }
  take()
  const subscription = $analyzeRequest.subscribe(() => take())
  const stopKeys = initResultKeys()
  return () => {
    subscription.unsubscribe()
    stopKeys()
  }
}
