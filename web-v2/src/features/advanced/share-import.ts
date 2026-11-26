import { setQuery } from '../../app/store/query'
import { decodeShareText } from '../../engine/wasm'
import { AppStore } from '../../shared/store/persistent'
import { fromQueryJson } from '../query/query'
import { normalizedQuery } from '../query/requirements/board'
import { anySearchActive } from '../search/tabs'

/** Why the last share link could not be loaded, until dismissed. */
export const $shareNotice = new AppStore<string | undefined>(undefined)

export function dismissShareNotice(): void {
  $shareNotice.set(undefined)
}

/** Imports the query share fragment captured on document load. */
export async function openShareLink(fragment: string): Promise<void> {
  try {
    const json = await decodeShareText(fragment)
    if (anySearchActive())
      throw new Error('a search is running — stop it first')
    // A list from elsewhere comes in canonical, as the editor writes it.
    setQuery(normalizedQuery(fromQueryJson(json)))
    $shareNotice.set(undefined)
  } catch (error) {
    $shareNotice.set(error instanceof Error ? error.message : String(error))
  }
}
