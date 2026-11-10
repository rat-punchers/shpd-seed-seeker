/**
 * The previewed seed's report, from the report worker Analyze uses. Recent
 * reports are cached, so stepping back is instant; a quick run of steps
 * (a held J/K) asks only for the seed it stops on.
 */
import { useEffect, useState } from 'react'
import type {
  QueryDocument,
  SeedReport,
  SeedReportRequest,
} from '../../../engine/types'
import {
  CANCELLED,
  type ReportClient,
  type ReportTask,
  requestReport,
} from '../../analyze/report-client'

const CACHE_SIZE = 32
const DEBOUNCE_MS = 120

const cache = new Map<string, SeedReport>()
let client: ReportClient = requestReport

/** Replaces the report worker and clears the cache, for tests. */
export function setPreviewReportClient(next: ReportClient): void {
  client = next
  cache.clear()
}

function remember(key: string, report: SeedReport) {
  cache.delete(key)
  cache.set(key, report)
  for (const oldest of cache.keys()) {
    if (cache.size <= CACHE_SIZE) break
    cache.delete(oldest)
  }
}

/** The report request for a result, as Analyze would ask for it. */
export function previewRequest(
  seed: string,
  query: QueryDocument | undefined,
  trinket: string | undefined
): SeedReportRequest {
  return {
    seed,
    ...(query ? { query } : {}),
    ...(query?.challenges?.length ? { challenges: query.challenges } : {}),
    ...(trinket ? { trinket } : {}),
  }
}

export interface PreviewReport {
  /** The asked report, or the previous one while it loads. */
  report: SeedReport | null
  /** `report` belongs to an earlier request. */
  stale: boolean
  loading: boolean
  error: string | null
}

interface Settled {
  key: string
  report: SeedReport | null
  error: string | null
}

/** Asks for `request`'s report; undefined asks for nothing. */
export function usePreviewReport(
  request: SeedReportRequest | undefined
): PreviewReport {
  const key = request ? JSON.stringify(request) : ''
  const [settled, setSettled] = useState<Settled>({
    key: '',
    report: null,
    error: null,
  })

  useEffect(() => {
    if (!key) return
    const hit = cache.get(key)
    if (hit) {
      setSettled({ key, report: hit, error: null })
      return
    }
    let task: ReportTask | undefined
    const timer = window.setTimeout(() => {
      task = client(JSON.parse(key) as SeedReportRequest)
      task.promise.then(
        (report) => {
          remember(key, report)
          setSettled({ key, report, error: null })
        },
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          if (message === CANCELLED) return
          setSettled({ key, report: null, error: message })
        }
      )
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      task?.cancel()
    }
  }, [key])

  if (!key) return { report: null, stale: false, loading: false, error: null }
  const hit = cache.get(key)
  if (settled.key === key)
    return {
      report: settled.report,
      stale: false,
      loading: false,
      error: settled.error,
    }
  if (hit) return { report: hit, stale: false, loading: false, error: null }
  return { report: settled.report, stale: true, loading: true, error: null }
}
