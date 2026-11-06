import { setMode } from '../../app/store/mode'
import type { QueryDocument } from '../../engine/types'
import { AppStore } from '../../shared/store/persistent'

/**
 * A seed another workspace asked Analyze to open, with the context that
 * found it: the query its report should match against and, for a search
 * result, the trinket choice the search recorded (`"none"` for No Trinket).
 */
export interface AnalyzeRequest {
  seed: string
  query?: QueryDocument
  trinket?: string
}

/** The latest request; Analyze consumes it when it opens the seed. */
export const $analyzeRequest = new AppStore<AnalyzeRequest | undefined>(
  undefined
)

/** Hands a seed to Analyze and switches to it. */
export function requestAnalyze(request: AnalyzeRequest): void {
  $analyzeRequest.set(request)
  setMode('analyze')
}
