import { setMode } from '../../app/store/mode'
import { formatSeedCode } from '../../engine/wasm'
import { $analyzeRequest } from './handoff'
import { initResultKeys } from './navigation'
import { loadSeedFormatter } from './seed-input'
import { $seedInput, openSeed, restoreSessions } from './sessions'

/** The seed a `?scout=` link asks for, if any. */
export function scoutLinkSeed(search: string): string | undefined {
  const seed = new URLSearchParams(search).get('scout')?.trim()
  return seed ? seed : undefined
}

/**
 * Starts Analyze: restores the saved tabs, opens a `?scout=` seed link,
 * takes seeds handed over by Find, and installs J/K. Returns the cleanup.
 */
export function initAnalyze(): () => void {
  const linked = scoutLinkSeed(window.location.search)
  if (linked) setMode('analyze')
  const ready = loadSeedFormatter()
  // Text typed before the engine loaded is grouped once it has.
  void ready.then(
    () => $seedInput.set(formatSeedCode($seedInput.get())),
    () => undefined
  )
  void restoreSessions().then(async () => {
    if (!linked) return
    // Format like the seed field, so `?scout=abcdefghi` opens `ABC-DEF-GHI`.
    const seed = await ready.then(
      () => formatSeedCode(linked),
      () => linked
    )
    await openSeed({ seed: seed || linked })
  })

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
