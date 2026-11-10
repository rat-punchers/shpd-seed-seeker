/**
 * The result each Find results tab previews. A tab previews its first
 * result until one is picked; J (next) and K (previous) step through the
 * results while the preview is on screen. Kept in memory only.
 */
import { $mode } from '../../../app/store/mode'
import type { ParsedSeed } from '../../../engine/types'
import { AppStore } from '../../../shared/store/persistent'
import { keyDelta, stepResult, typingOrModal } from '../../analyze/navigation'
import { RESULT_CAP } from '../../search/coordinator-state'
import { searchStore } from '../../search/store'
import { activeResultsTabId } from '../../search/tabs'

/** Wide enough for the result list and the preview side by side (`lg`). */
export const PREVIEW_MEDIA = '(min-width: 64rem)'

/** The picked seed code per results tab id. */
export const $previewPicks = new AppStore<Readonly<Record<number, string>>>({})

/** The listed results: the store keeps more for refine, the list shows the cap. */
export const listedMatches = (matches: readonly ParsedSeed[]) =>
  matches.slice(0, RESULT_CAP)

/** The tab's pick while it is still a result, else its first result. */
export function previewedMatch(
  matches: readonly ParsedSeed[],
  pick: string | undefined
): ParsedSeed | undefined {
  return (
    (pick === undefined
      ? undefined
      : matches.find((match) => match.code === pick)) ?? matches[0]
  )
}

/** The trinket a result was found with: an offer id, `"none"`, or unknown. */
export function matchTrinket(match: ParsedSeed): string | undefined {
  return match.selectedTrinket === null ? 'none' : match.selectedTrinket
}

/** Previews `code` in the shown results tab. */
export function pickPreview(code: string): void {
  const tab = activeResultsTabId()
  if ($previewPicks.get()[tab] === code) return
  $previewPicks.set({ ...$previewPicks.get(), [tab]: code })
}

/** Previews the result `delta` steps away; false when there is none. */
export function stepPreview(delta: number): boolean {
  const matches = listedMatches(searchStore.state.matches)
  const current = previewedMatch(
    matches,
    $previewPicks.get()[activeResultsTabId()]
  )
  const next = stepResult(
    matches.map((match) => match.code),
    current?.code,
    delta
  )
  if (!next) return false
  pickPreview(next)
  return true
}

/** Installs J/K for the preview while Find shows it. Returns the cleanup. */
export function initPreviewKeys(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const delta = keyDelta(event)
    if (delta === 0 || $mode.get() !== 'find' || typingOrModal(event)) return
    if (!window.matchMedia(PREVIEW_MEDIA).matches) return
    if (stepPreview(delta)) event.preventDefault()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
