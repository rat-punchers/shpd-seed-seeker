import { $mode } from '../../app/store/mode'
import { $query, $workerCount } from '../../app/store/query'
import type { AnalysisResult, ParsedSeed } from '../../engine/types'
import { analyzeQuery, getEngineInfo } from '../../engine/wasm'
import { AppStore } from '../../shared/store/persistent'
import { requestAnalyze } from '../analyze'
import { toQueryDocument, toQueryJson } from '../query/query'
import { hasRequirements, validateQuery } from '../query/validation'
import { SearchCoordinator } from '../search/coordinator'
import { searchStore } from '../search/store'
import { activeResultsTabId, anySearchActive } from '../search/tabs'
import { initPreviewKeys } from './preview/selection'

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
  if (anySearchActive()) {
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

/** Opens a search result in Analyze with the query and trinket that found it. */
export function analyzeMatch(match: ParsedSeed): void {
  const query = searchStore.state.query
  const trinket =
    match.selectedTrinket === null ? 'none' : match.selectedTrinket
  requestAnalyze({
    seed: match.code,
    results: activeResultsTabId(),
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
  if (anySearchActive()) event.preventDefault()
}

/**
 * Starts Find's effects: the search coordinator, the debounced query
 * analysis, the keyboard shortcut and the leave-page warning. Returns the
 * cleanup.
 */
export function initFind(): () => void {
  // The engine (several MB) loads only once Find opens; Analyze's first
  // screen does not need it. Workers load their engine on start; Find starts
  // them before the first search.
  const open = () => {
    if ($mode.get() !== 'find') return
    void getCoordinator().then((ready) => ready.warm($workerCount.get()))
    void refreshAnalysis()
  }
  open()
  const modeSubscription = $mode.subscribe(open)
  let timer: ReturnType<typeof setTimeout> | undefined
  const subscription = $query.subscribe(() => {
    clearTimeout(timer)
    if ($mode.get() !== 'find') return
    timer = setTimeout(() => void refreshAnalysis(), ANALYSIS_DEBOUNCE_MS)
  })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('beforeunload', onBeforeUnload)
  const stopPreviewKeys = initPreviewKeys()
  return () => {
    stopPreviewKeys()
    clearTimeout(timer)
    subscription.unsubscribe()
    modeSubscription.unsubscribe()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('beforeunload', onBeforeUnload)
  }
}
