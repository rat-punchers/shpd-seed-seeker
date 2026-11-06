import { afterEach } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { renderToStaticMarkup } from 'react-dom/server'
import { setFindView } from '../../../src/app/store/find-view'
import { setQuery } from '../../../src/app/store/query'
import { analyze_query } from '../../../src/engine/pkg/seedfinder.js'
import type { AnalysisResult, QueryState } from '../../../src/engine/types'
import { FinderForm } from '../../../src/features/find'
import { $analysis } from '../../../src/features/find/run'
import {
  defaultQueryState,
  toQueryJson,
} from '../../../src/features/query/query'

/** The engine's analysis of a query state. */
export const analysisOf = (query: QueryState): AnalysisResult =>
  JSON.parse(analyze_query(toQueryJson(query))) as AnalysisResult

/**
 * Find's sidebar in the Advanced view for `query`, with `analysis` as the
 * estimate, drawn once as a detached DOM tree.
 */
export function renderAdvanced(
  query: QueryState,
  analysis?: AnalysisResult
): HTMLElement {
  setQuery(query)
  setFindView('advanced')
  $analysis.set(analysis)
  const element = document.createElement('div')
  element.innerHTML = renderToStaticMarkup(
    <TooltipProvider>
      <FinderForm />
    </TooltipProvider>
  )
  return element
}

/** Find's start button as drawn. */
export const findButton = (element: HTMLElement) =>
  [...element.querySelectorAll('button[type="submit"]')].find((button) =>
    button.textContent?.includes('Find')
  ) as HTMLButtonElement | undefined

/** Resets the stores `renderAdvanced` writes after each test. */
export function resetAdvancedRender(): void {
  afterEach(() => {
    setQuery(defaultQueryState())
    setFindView('simple')
    $analysis.set(undefined)
    localStorage.clear()
  })
}
