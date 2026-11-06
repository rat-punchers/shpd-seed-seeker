import { $mode } from '../../app/store/mode'
import { $query, $workerCount } from '../../app/store/query'
import type { AnalysisResult, ParsedSeed } from '../../engine/types'
import { analyzeQuery, getEngineInfo } from '../../engine/wasm'
import { AppStore } from '../../shared/store/persistent'
import { requestAnalyze } from '../analyze'
import { toQueryDocument, toQueryJson } from '../query/query'
import { hasRequirements, validateQuery } from '../query/validation'
import { SearchCoordinator } from '../search/coordinator'
import { isSearchActive } from '../search/coordinator-state'
import { searchStore } from '../search/store'

/** The engine's estimate for the saved query, or none for an empty query. */
export const $analysis = new AppStore<AnalysisResult | undefined>(undefined)

/** How long the query must sit still before it is re-analyzed. */
const ANALYSIS_DEBOUNCE_MS = 250

let coordinator: SearchCoordinator | undefined
let coordinatorReady: Promise<SearchCoordinator> | undefined

function getCoordinator(): Promise<SearchCoordinator> {
  coordinatorReady ??= getEngineInfo().then((info) => {
    coordinator = new SearchCoordinator(info.totalSeeds)
    return coordinator
  })
  return coordinatorReady
}

let analysisRequest = 0

/** Analyzes the saved query now; a later call wins over an earlier one. */
export async function refreshAnalysis(): Promise<AnalysisResult | undefined> {
  const request = ++analysisRequest
  const query = $query.get()
  const result = hasRequirements(query)
    ? await analyzeQuery(toQueryJson(query)).catch(() => undefined)
    : undefined
  if (request === analysisRequest) $analysis.set(result)
  return result
}

/**
 * Starts a search for the saved query, or cancels the one running. A start
 * re-analyzes the query first, so a keyboard start during the debounce
 * checks the current query, never the last displayed estimate.
 */
export async function toggleSearch(): Promise<void> {
  const controller = await getCoordinator()
  if (isSearchActive(searchStore.state)) {
    controller.cancel()
    return
  }
  const query = $query.get()
  if (!validateQuery(query).valid) return
  const analysis = await refreshAnalysis()
  if ($query.get() !== query) return
  if (!analysis?.valid || analysis.impossible) return
  controller.start(toQueryDocument(query), $workerCount.get())
}

export function cancelSearch(): void {
  coordinator?.cancel()
}

/** Opens a search result in Analyze with the query and trinket that found it. */
export function analyzeMatch(match: ParsedSeed): void {
  const query = searchStore.state.query
  const trinket =
    match.selectedTrinket === null ? 'none' : match.selectedTrinket
  requestAnalyze({
    seed: match.code,
    ...(query ? { query } : {}),
    ...(trinket ? { trinket } : {}),
  })
}

/** Ctrl/Cmd+Enter starts or cancels the search while Find is open. */
function onKeyDown(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return
  if ($mode.get() !== 'find') return
  event.preventDefault()
  void toggleSearch()
}

/** Leaving the page while a search runs asks first. */
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (isSearchActive(searchStore.state)) event.preventDefault()
}

/**
 * Starts Find's effects: the search coordinator, the debounced query
 * analysis, the keyboard shortcut and the leave-page warning. Returns the
 * cleanup.
 */
export function initFind(): () => void {
  void getCoordinator()
  let timer: ReturnType<typeof setTimeout> | undefined
  void refreshAnalysis()
  const subscription = $query.subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(() => void refreshAnalysis(), ANALYSIS_DEBOUNCE_MS)
  })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('beforeunload', onBeforeUnload)
  return () => {
    clearTimeout(timer)
    subscription.unsubscribe()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('beforeunload', onBeforeUnload)
  }
}
