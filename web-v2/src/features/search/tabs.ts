/**
 * Find's results tabs. Each tab holds one search state; `searchStore` is the
 * active tab's, so everything that shows results reads it. A search keeps
 * writing to the tab it started in while another tab is shown. Saved to
 * localStorage (throttled, and on page hide) and restored on load.
 */
import { Store } from '@tanstack/store'
import { CONFIG } from '../../config'
import {
  type CoordinatorState,
  initialCoordinatorState,
  isSearchActive,
} from './coordinator-state'
import { searchStore } from './store'
import { decodeTabs, encodeTabs, type ResultsTabs } from './tabs-codec'

export type { ResultsTab, ResultsTabs } from './tabs-codec'

/** The most tabs kept; opening one more drops the oldest idle tab. */
export const MAX_RESULTS_TABS = 8
const SAVE_DELAY_MS = 1_000
const KEY = CONFIG.storageKeys.resultsTabs

export const resultsTabLabel = (id: number) => `Results #${id}`

const freshTabs = (search = initialCoordinatorState()): ResultsTabs => ({
  tabs: [{ id: 1, search }],
  activeId: 1,
  nextId: 2,
})

function load(): ResultsTabs {
  try {
    const text = localStorage.getItem(KEY)
    if (text) return decodeTabs(text) ?? freshTabs()
  } catch {
    // Start empty when storage cannot be read.
  }
  return freshTabs()
}

export const resultsTabsStore = new Store<ResultsTabs>(load())

const activeOf = (state: ResultsTabs) =>
  state.tabs.find((tab) => tab.id === state.activeId)

searchStore.setState(
  () => activeOf(resultsTabsStore.state)?.search ?? initialCoordinatorState()
)

searchStore.subscribe(() => {
  const search = searchStore.state
  resultsTabsStore.setState((state) => ({
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === state.activeId ? { ...tab, search } : tab
    ),
  }))
})

let saveTimer: ReturnType<typeof setTimeout> | undefined

/** Writes the tabs now instead of on the throttle. */
export function saveResultsTabs(): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    localStorage.setItem(KEY, encodeTabs(resultsTabsStore.state))
  } catch {
    // Keep the tabs in memory when storage cannot be written.
  }
}

resultsTabsStore.subscribe(() => {
  saveTimer ??= setTimeout(saveResultsTabs, SAVE_DELAY_MS)
})
if (typeof window !== 'undefined')
  window.addEventListener('pagehide', saveResultsTabs)

export const activeResultsTabId = () => resultsTabsStore.state.activeId

/** The tab whose search is running or stopping, if any. */
export const searchingTabId = (state: ResultsTabs) =>
  state.tabs.find((tab) => isSearchActive(tab.search))?.id

/** Whether any tab's search is running or stopping; the query is locked. */
export const anySearchActive = () =>
  searchingTabId(resultsTabsStore.state) !== undefined

export const latestSessionId = () =>
  Math.max(0, ...resultsTabsStore.state.tabs.map((tab) => tab.search.sessionId))

export function tabSearch(id: number): CoordinatorState | undefined {
  if (id === resultsTabsStore.state.activeId) return searchStore.state
  return resultsTabsStore.state.tabs.find((tab) => tab.id === id)?.search
}

export function updateTabSearch(
  id: number,
  update: (search: CoordinatorState) => CoordinatorState
): void {
  if (id === resultsTabsStore.state.activeId) {
    searchStore.setState(update)
    return
  }
  resultsTabsStore.setState((state) => ({
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, search: update(tab.search) } : tab
    ),
  }))
}

/** Gives idle tabs the engine's seed count, which progress is shown against. */
export function setResultsTotal(total: number): void {
  for (const tab of resultsTabsStore.state.tabs)
    if (tab.search.state === 'idle' && tab.search.total !== total)
      updateTabSearch(tab.id, (search) => ({ ...search, total }))
}

export function selectResultsTab(id: number): void {
  const state = resultsTabsStore.state
  const tab = state.tabs.find((entry) => entry.id === id)
  if (!tab || id === state.activeId) return
  resultsTabsStore.setState((current) => ({ ...current, activeId: id }))
  searchStore.setState(() => tab.search)
}

/** Opens an empty tab and shows it. */
export function addResultsTab(): number {
  const { tabs, nextId, activeId } = resultsTabsStore.state
  const kept = [
    ...tabs,
    { id: nextId, search: initialCoordinatorState(searchStore.state.total) },
  ]
  while (kept.length > MAX_RESULTS_TABS) {
    const oldest = kept.findIndex(
      (tab) => !isSearchActive(tab.search) && tab.id !== nextId
    )
    if (oldest < 0) break
    kept.splice(oldest, 1)
  }
  resultsTabsStore.setState(() => ({
    tabs: kept,
    activeId,
    nextId: nextId + 1,
  }))
  selectResultsTab(nextId)
  return nextId
}

/** Closes a tab unless it is the last one or its search is running. */
export function closeResultsTab(id: number): void {
  const { tabs, activeId } = resultsTabsStore.state
  const index = tabs.findIndex((tab) => tab.id === id)
  const tab = tabs[index]
  if (!tab || tabs.length <= 1 || isSearchActive(tab.search)) return
  const next = tabs.filter((entry) => entry.id !== id)
  const shown = activeId === id ? (next[index] ?? next[index - 1]) : undefined
  resultsTabsStore.setState((state) => ({
    ...state,
    tabs: next,
    activeId: shown?.id ?? state.activeId,
  }))
  if (shown) searchStore.setState(() => shown.search)
}

/** Back to one empty tab, for tests. */
export function resetResultsTabs(): void {
  resultsTabsStore.setState(() => freshTabs(searchStore.state))
  searchStore.setState(() => initialCoordinatorState())
}
