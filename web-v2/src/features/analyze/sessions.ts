/**
 * Analyze's seed tabs: open, report, regenerate, close, restore.
 *
 * Persisted: each open seed with the context its report was asked with
 * (query, trinket, challenges, journal), and the active tab. Reports are not stored;
 * a reload asks for them again.
 */
import { CONFIG } from '../../config'
import type { SeedReport, SeedReportRequest } from '../../engine/types'
import { AppStore, persistentStore } from '../../shared/store/persistent'
import type { AnalyzeRequest } from './handoff'
import {
  type ReportClient,
  type ReportTask,
  requestReport,
} from './report-client'
import {
  contextOf,
  MAX_OPEN_SEEDS,
  type RunSettings,
  type SessionContext,
  savedCodec,
} from './session-context'

export { MAX_OPEN_SEEDS } from './session-context'

export type SessionStatus =
  | 'pending'
  | 'loading'
  | 'ready'
  | 'cancelled'
  | 'error'

export interface SeedSession extends SessionContext {
  /** The tab id: the results tab it belongs to, else the seed as entered. */
  id: string
  status: SessionStatus
  /** The latest report; kept on screen while a regenerated one loads. */
  report: SeedReport | null
  error: string | null
  startedAt: number | null
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

export function sessionIdFor(seed: string, results?: number): string {
  return results === undefined
    ? seed.trim().toUpperCase()
    : `results-${results}`
}

function newSession(context: SessionContext): SeedSession {
  return {
    ...contextOf(context),
    id: sessionIdFor(context.seed, context.results),
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
  const { results: _results, ...request } = contextOf(session)
  return request
}

/** Asks for the session's report; resolves once it lands or fails. */
async function run(id: string, settings?: RunSettings): Promise<void> {
  const session = findSession(id)
  if (!session) return
  cancelTask(id)
  patch(id, { status: 'loading', error: null, startedAt: Date.now() })
  let task: ReportTask | undefined
  try {
    task = client(requestFor({ ...session, ...settings }))
    tasks.set(id, task)
    const report = await task.promise
    if (tasks.get(id) !== task) return
    patch(id, { ...settings, status: 'ready', report, error: null })
  } catch (error) {
    if (tasks.get(id) !== task) return
    patch(id, {
      status: settings ? 'ready' : 'error',
      report: settings ? session.report : null,
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (task && tasks.get(id) === task) tasks.delete(id)
  }
}

function sameContext(a: SessionContext, b: SessionContext): boolean {
  return JSON.stringify(contextOf(a)) === JSON.stringify(contextOf(b))
}

/**
 * Opens a seed in a tab and reports it. An open seed is focused instead;
 * it reports again when asked with a different context or after a failure.
 */
export async function openSeed(
  request: AnalyzeRequest & RunSettings
): Promise<void> {
  const context = contextOf({
    ...request,
    seed: request.seed.trim(),
    challenges: request.challenges ?? request.query?.challenges,
  })
  if (!context.seed) return
  const id = sessionIdFor(context.seed, context.results)
  const existing = findSession(id)
  $activeSeedId.set(id)
  if (existing) {
    const changed =
      (request.query ||
        request.trinket ||
        request.challenges ||
        request.lorePages !== undefined ||
        request.results !== undefined) &&
      !sameContext(existing, context)
    // Replace rather than patch: keys the new context leaves out must clear.
    if (changed)
      setSessions(
        $sessions.get().map((s) =>
          s.id === id
            ? {
                ...newSession(context),
                report: s.seed === context.seed ? existing.report : null,
              }
            : s
        )
      )
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
  const id = sessionIdFor(context.seed, context.results)
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

/** Applies a journal or challenge change only when its report succeeds. */
export function updateRunSettings(
  id: string,
  settings: RunSettings
): Promise<void> {
  const session = findSession(id)
  if (session?.status !== 'ready' || !session.report) return Promise.resolve()
  if (sameContext(session, { ...session, ...settings }))
    return Promise.resolve()
  return run(id, settings)
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
