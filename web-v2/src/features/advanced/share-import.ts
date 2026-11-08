import { setFindView } from '../../app/store/find-view'
import { setMode } from '../../app/store/mode'
import { setQuery } from '../../app/store/query'
import { decodeShareText } from '../../engine/wasm'
import { AppStore } from '../../shared/store/persistent'
import { fromQueryJson } from '../query/query'
import { normalizedQuery } from '../query/requirements/board'
import { hasShareCode, withoutFragment } from '../query/share-link'
import { anySearchActive } from '../search/tabs'

/** Why the last share link could not be loaded, until dismissed. */
export const $shareNotice = new AppStore<string | undefined>(undefined)

export function dismissShareNotice(): void {
  $shareNotice.set(undefined)
}

/**
 * Loads the share link in the address bar (`#q=CODE`) into the saved query,
 * then leaves a clean address bar so reloads and copied URLs don't apply it
 * again. The query opens in Advanced, which shows all of it, or the notice
 * of why it could not load.
 */
export async function openShareLink(): Promise<void> {
  if (!hasShareCode(window.location.hash)) return
  setMode('find')
  setFindView('advanced')
  try {
    const json = await decodeShareText(window.location.href)
    if (anySearchActive())
      throw new Error('a search is running — stop it first')
    // A list from elsewhere comes in canonical, as the editor writes it.
    setQuery(normalizedQuery(fromQueryJson(json)))
    $shareNotice.set(undefined)
  } catch (error) {
    $shareNotice.set(error instanceof Error ? error.message : String(error))
  } finally {
    window.history.replaceState(null, '', withoutFragment(window.location.href))
  }
}

/**
 * Opens the share link the page loaded with, and any opened into this tab
 * later, where the browser changes the fragment without reloading. Returns
 * the cleanup.
 */
export function initShareLink(): () => void {
  const open = () => void openShareLink()
  open()
  window.addEventListener('hashchange', open)
  return () => window.removeEventListener('hashchange', open)
}
