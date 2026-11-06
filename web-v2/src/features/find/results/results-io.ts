import { setQuery } from '../../../app/store/query'
import { getEngineInfo, initEngine } from '../../../engine/wasm'
import { AppStore } from '../../../shared/store/persistent'
import { normalizedQuery } from '../../query/requirements/board'
import { isSearchActive } from '../../search/coordinator-state'
import {
  clearResults,
  loadImportedResults,
  searchStore,
} from '../../search/store'
import {
  decodeResultsFile,
  encodeResultsFile,
  parsedSeedFromCode,
  RESULTS_FILE_NAME,
} from './results-file'

/** What the last import or export has to tell: a failure, or a caveat. */
export type ResultsNotice = { kind: 'error' | 'info'; text: string }

export const $resultsNotice = new AppStore<ResultsNotice | undefined>(undefined)

const fail = (error: unknown) =>
  $resultsNotice.set({
    kind: 'error',
    text: error instanceof Error ? error.message : String(error),
  })

function downloadJson(text: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/**
 * Downloads the shown results with the query snapshot captured when they
 * were produced (at search start or import), never the live query.
 */
export async function exportResults(): Promise<void> {
  const { query, matches } = searchStore.state
  if (!query || matches.length === 0) {
    fail('Run a search first: there are no results to export yet.')
    return
  }
  try {
    await initEngine()
    const trinkets = matches.every(
      (match) => match.selectedTrinket !== undefined
    )
      ? matches.map((match) => match.selectedTrinket ?? null)
      : undefined
    downloadJson(
      encodeResultsFile(
        query,
        matches.map((match) => match.code),
        trinkets
      ),
      RESULTS_FILE_NAME
    )
    $resultsNotice.set(undefined)
  } catch (error) {
    fail(error)
  }
}

/**
 * Imports a results file, or a query copied with Copy JSON. The engine's
 * codec owns the size limit, the envelope rules, the query validation and
 * dedupe-and-cap, and words its own failures. A copied query replaces the
 * saved query only and leaves the results list to the search that made it.
 */
export async function importResults(
  readText: () => Promise<string>
): Promise<void> {
  try {
    await initEngine()
    const decoded = decodeResultsFile(await readText())
    // A search may have started while the picker or the read were pending.
    if (isSearchActive(searchStore.state))
      throw new Error('A search is running. Stop it before importing results.')
    $resultsNotice.set(undefined)
    if (decoded.bareQuery) {
      setQuery(normalizedQuery(decoded.query))
      return
    }
    setQuery(decoded.query)
    loadImportedResults(
      decoded.seeds.map((code, index) => {
        const trinket = decoded.trinkets[index]
        return {
          ...parsedSeedFromCode(code),
          ...(trinket !== undefined ? { selectedTrinket: trinket } : {}),
        }
      }),
      decoded.queryDocument,
      decoded.dropped
    )
    const { shpdVersion } = await getEngineInfo()
    if (
      decoded.shpdVersion !== undefined &&
      decoded.shpdVersion !== shpdVersion
    )
      $resultsNotice.set({
        kind: 'info',
        text: `This JSON was made for Shattered Pixel Dungeon v${decoded.shpdVersion}; this app targets v${shpdVersion}. The seeds may generate differently.`,
      })
  } catch (error) {
    fail(error)
  }
}

/** Imports the clipboard's text, explaining a clipboard that cannot be read. */
export function importClipboard(): Promise<void> {
  return importResults(async () => {
    if (!navigator.clipboard?.readText)
      throw new Error(
        'Clipboard access is unavailable. Open this page over HTTPS or import a JSON file.'
      )
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      throw new Error(
        'Could not read the clipboard. Allow clipboard access in your browser or import a JSON file.'
      )
    }
    if (!text.trim())
      throw new Error(
        'The clipboard has no text. Copy results JSON and try again.'
      )
    return text
  })
}

/** Imports a picked file. */
export function importFile(file: File): Promise<void> {
  return importResults(() => file.text())
}

/** Clear drops the results, the retained pool and any import notice. */
export function discardResults(): void {
  clearResults()
  $resultsNotice.set(undefined)
}
