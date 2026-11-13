import { CONFIG } from '../../config'
import type { QueryState } from '../../engine/types'
import {
  defaultQueryState,
  fromQueryJson,
  toQueryJson,
} from '../../features/query/query'
import { persistentStore } from '../../shared/store/persistent'

/**
 * The one saved query. Find's Simple view and Advanced are two views of it;
 * it is stored as a query document, so an unreadable copy falls back to the
 * default query.
 */
export const $query = persistentStore<QueryState>(
  CONFIG.storageKeys.query,
  defaultQueryState(),
  { encode: toQueryJson, decode: fromQueryJson }
)

export function setQuery(query: QueryState) {
  $query.set(query)
}

/** Logical processors available for search workers, always at least 1. */
export const maxWorkers = (): number =>
  Math.max(
    1,
    (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
  )

const clampWorkers = (count: number): number =>
  Math.min(Math.max(1, Math.floor(count)), maxWorkers())

/** How many search workers to run; a saved count above the ceiling is clamped. */
export const $workerCount = persistentStore<number>(
  CONFIG.storageKeys.workers,
  maxWorkers(),
  {
    encode: String,
    decode: (text) => {
      const saved = Number(text)
      return Number.isFinite(saved) && saved >= 1
        ? clampWorkers(saved)
        : maxWorkers()
    },
  }
)

export function setWorkerCount(count: number) {
  $workerCount.set(clampWorkers(count))
}
