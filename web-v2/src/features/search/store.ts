import { Store } from '@tanstack/store'
import type { ParsedSeed, QueryDocument } from '../../engine/types'
import {
  type CoordinatorState,
  canClearResults,
  importedResultsState,
  initialCoordinatorState,
} from './coordinator-state'

/** The one search run: its progress, its matches and the retained seed pool. */
export const searchStore = new Store<CoordinatorState>(
  initialCoordinatorState()
)

/** Imports add to the retained pool and display the imported matches. */
export function loadImportedResults(
  matches: ParsedSeed[],
  query: QueryDocument,
  dropped = 0
): void {
  searchStore.setState((state) =>
    importedResultsState(state, matches, query, dropped)
  )
}

/** Clear is the only action that discards the retained seed pool. */
export function clearResults(): void {
  if (!canClearResults(searchStore.state)) return
  searchStore.setState((state) => ({
    ...initialCoordinatorState(state.total),
    sessionId: state.sessionId,
  }))
}
