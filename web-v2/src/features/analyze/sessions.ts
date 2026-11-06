/**
 * Analyze's seed tabs: open, report, regenerate, close, restore.
 *
 * Persisted: each open seed with the context its report was asked with
 * (query, trinket, challenges), and the active tab. Reports are not stored;
 * a reload asks for them again.
 */
import { CONFIG } from '../../config'
import type {
  ChallengeName,
  QueryDocument,
  SeedReport,
  SeedReportRequest,
} from '../../engine/types'
import { AppStore, persistentStore } from '../../shared/store/persistent'
import type { AnalyzeRequest } from './handoff'
import {
  type ReportClient,
  type ReportTask,
  requestReport,
} from './report-client'

/** The most tabs kept open; opening one more drops the oldest. */
export const MAX_OPEN_SEEDS = 10

export type SessionStatus =
  | 'pending'
  | 'loading'
  | 'ready'
  | 'cancelled'
  | 'error'

/** What a report is asked with, and what a reload restores. */
export interface SessionContext {
  /** A seed code (`ABC-DEF-GHI`) or daily date, as formatted for input. */
  seed: string
  query?: QueryDocument
  /** A Catalyst offer id or `"none"`; absent lets the query choose. */
  trinket?: string
  challenges?: ChallengeName[]
}

export interface SeedSession extends SessionContext {
  /** The tab id: the seed as entered. */
  id: string
  status: SessionStatus
  /** The latest report; kept on screen while a regenerated one loads. */
  report: SeedReport | null
  error: string | null
  startedAt: number | null
}

const savedCodec = {
  encode: (value: SessionContext[]) => JSON.stringify(value),
  decode: (text: string): SessionContext[] => {
    try {
      const parsed = JSON.parse(text) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter(
          (entry): entry is SessionContext =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as SessionContext).seed === 'string'
        )
        .slice(-MAX_OPEN_SEEDS)
    } catch {
      return []
    }
  },
}

export const $savedSeeds = persistentStore<SessionContext[]>(
  CONFIG.storageKeys.openSeeds,
  [],
  savedCodec
)

export const $activeSeedId = persistentStore<string | null>(
  CONFIG.storageKeys.activeSeed,
  null,
  { encode: (value) => value ?? '', decode: (text) => text || null }
)

export const $sessions = new AppStore<SeedSession[]>([])

/** The sidebar's seed field. */
export const $seedInput = new AppStore('')

let client: ReportClient = requestReport
const tasks = new Map<string, ReportTask>()

/** Replaces the report worker, for tests. */
export function setReportClient(next: ReportClient): void {
  client = next
}

export function sessionIdFor(seed: string): string {
  return seed.trim().toUpperCase()
}

function contextOf(session: SessionContext): SessionContext {
  const { seed, query, trinket, challenges } = session
  return {
    seed,
    ...(query ? { query } : {}),
    ...(trinket ? { trinket } : {}),
    ...(challenges?.length ? { challenges } : {}),
  }
}

function newSession(context: SessionContext): SeedSession {
  return {
    ...contextOf(context),
    id: sessionIdFor(context.seed),
    status: 'pending',
    report: null,
    error: null,
    startedAt: null,
  }
}

function setSessions(next: SeedSession[]) {
  $sessions.set(next)
  $savedSeeds.set(next.map(contextOf))
}

function patch(id: string, change: Partial<SeedSession>) {
  const sessions = $sessions.get()
  if (!sessions.some((session) => session.id === id)) return
  setSessions(sessions.map((s) => (s.id === id ? { ...s, ...change } : s)))
}

export function findSession(id: string | null): SeedSession | undefined {
  return $sessions.get().find((session) => session.id === id)
}

export function requestFor(session: SessionContext): SeedReportRequest {
  return contextOf(session)
}

/** Asks for the session's report; resolves once it lands or fails. */
async function run(id: string): Promise<void> {
  const session = findSession(id)
  if (!session) return
  tasks.get(id)?.cancel()
  const task = client(requestFor(session))
  tasks.set(id, task)
  patch(id, { status: 'loading', error: null, startedAt: Date.now() })
  try {
    const report = await task.promise
    if (tasks.get(id) !== task) return
    patch(id, { status: 'ready', report, error: null })
  } catch (error) {
    if (tasks.get(id) !== task) return
    patch(id, {
      status: 'error',
      report: null,
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (tasks.get(id) === task) tasks.delete(id)
  }
}

function sameContext(a: SessionContext, b: SessionContext): boolean {
  return JSON.stringify(contextOf(a)) === JSON.stringify(contextOf(b))
}

/**
 * Opens a seed in a tab and reports it. An open seed is focused instead;
 * it reports again when asked with a different context or after a failure.
 */
export async function openSeed(request: AnalyzeRequest): Promise<void> {
  const context = contextOf({
    ...request,
    seed: request.seed.trim(),
    ...(request.query?.challenges?.length
      ? { challenges: request.query.challenges }
      : {}),
  })
  if (!context.seed) return
  const id = sessionIdFor(context.seed)
  const existing = findSession(id)
  $activeSeedId.set(id)
  if (existing) {
    const changed =
      (request.query || request.trinket) && !sameContext(existing, context)
    if (changed) patch(id, { ...newSession(context), report: existing.report })
    else if (existing.status === 'ready' || existing.status === 'loading')
      return
    return run(id)
  }
  const sessions = $sessions.get()
  const overflow = Math.max(0, sessions.length - (MAX_OPEN_SEEDS - 1))
  for (const dropped of sessions.slice(0, overflow)) cancelTask(dropped.id)
  setSessions([...sessions.slice(overflow), newSession(context)])
  return run(id)
}

/**
 * Replaces the active tab with another seed (result navigation). A seed
 * already open in another tab is focused instead.
 */
export async function replaceActiveSeed(
  context: SessionContext
): Promise<void> {
  const active = findSession($activeSeedId.get())
  const id = sessionIdFor(context.seed)
  if (!active || findSession(id)) return openSeed(context)
  cancelTask(active.id)
  setSessions(
    $sessions.get().map((s) => (s.id === active.id ? newSession(context) : s))
  )
  $activeSeedId.set(id)
  return run(id)
}

function cancelTask(id: string) {
  tasks.get(id)?.cancel()
  tasks.delete(id)
}

export function setActiveSeed(id: string): void {
  $activeSeedId.set(id)
}

/** Closes a tab; the neighbour to its right (else left) becomes active. */
export function closeSession(id: string): void {
  cancelTask(id)
  const sessions = $sessions.get()
  const index = sessions.findIndex((session) => session.id === id)
  if (index < 0) return
  const next = sessions.filter((session) => session.id !== id)
  setSessions(next)
  if ($activeSeedId.get() === id) {
    $activeSeedId.set((next[index] ?? next[index - 1])?.id ?? null)
  }
}

export function cancelReport(id: string): void {
  const session = findSession(id)
  if (session?.status !== 'loading' && session?.status !== 'pending') return
  cancelTask(id)
  patch(id, { status: 'cancelled', error: null })
}

/** Regenerates a seed with another Catalyst choice (an offer id or `"none"`). */
export function selectTrinket(id: string, trinket: string): Promise<void> {
  const session = findSession(id)
  if (!session || session.trinket === trinket) return Promise.resolve()
  patch(id, { trinket })
  return run(id)
}

/** Restores the saved tabs and reports them one after another. */
export async function restoreSessions(): Promise<void> {
  const restored = $savedSeeds.get().map(newSession)
  if (restored.length === 0) return
  setSessions(restored)
  if (!findSession($activeSeedId.get())) {
    $activeSeedId.set(restored[0]?.id ?? null)
  }
  const active = $activeSeedId.get()
  const order = [...restored].sort(
    (a, b) => Number(b.id === active) - Number(a.id === active)
  )
  for (const session of order) {
    if (findSession(session.id)?.status === 'pending') await run(session.id)
  }
}

/** Drops every tab and its saved state, for tests. */
export function resetSessions(): void {
  for (const id of tasks.keys()) cancelTask(id)
  setSessions([])
  $activeSeedId.set(null)
  $seedInput.set('')
}
