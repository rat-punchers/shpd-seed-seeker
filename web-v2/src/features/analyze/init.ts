import { setMode } from '../../app/store/mode'
import { formatSeedCode } from '../../engine/wasm'
import { hasShareCode } from '../query/share-link'
import { $analyzeRequest } from './handoff'
import { initResultKeys } from './navigation'
import { loadSeedFormatter } from './seed-input'
import { openSeed, restoreSessions } from './sessions'

/** The seed a `?scout=` link asks for, if any. */
export function scoutLinkSeed(search: string): string | undefined {
  const seed = new URLSearchParams(search).get('scout')?.trim()
  return seed ? seed : undefined
}

/**
 * Starts Analyze: restores the saved tabs, opens a `?scout=` seed link,
 * takes seeds handed over by Find, and installs J/K. Returns the cleanup.
 * A query share link (`#q=`) takes priority over a seed link.
 */
export function initAnalyze(): () => void {
  const linked = hasShareCode(window.location.hash)
    ? undefined
    : scoutLinkSeed(window.location.search)
  if (linked) setMode('analyze')
  // Restored reports come from the report worker; only a link needs the
  // engine here.
  const ready = linked ? loadSeedFormatter() : undefined
  void restoreSessions().then(async () => {
    if (!linked || !ready) return
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
