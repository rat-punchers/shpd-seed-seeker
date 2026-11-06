import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { SeedReport, SeedReportRequest } from '../../../src/engine/types'
import { CANCELLED } from '../../../src/features/analyze/report-client'
import {
  $activeSeedId,
  $savedSeeds,
  $sessions,
  cancelReport,
  closeSession,
  findSession,
  MAX_OPEN_SEEDS,
  openSeed,
  replaceActiveSeed,
  resetSessions,
  restoreSessions,
  selectTrinket,
  setReportClient,
} from '../../../src/features/analyze/sessions'

/** A report client that answers when the test says so. */
function fakeClient() {
  const calls: {
    request: SeedReportRequest
    resolve: (report: SeedReport) => void
    reject: (error: Error) => void
    cancelled: boolean
  }[] = []
  setReportClient((request) => {
    let resolve: (report: SeedReport) => void = () => {}
    let reject: (error: Error) => void = () => {}
    const promise = new Promise<SeedReport>((ok, fail) => {
      resolve = ok
      reject = fail
    })
    const call = { request, resolve, reject, cancelled: false }
    calls.push(call)
    return {
      promise,
      cancel: () => {
        call.cancelled = true
        reject(new Error(CANCELLED))
      },
    }
  })
  return calls
}

function report(code: string): SeedReport {
  return { seed: { code, value: 0, daily: false } } as SeedReport
}

const ids = () => $sessions.get().map((session) => session.id)

let calls: ReturnType<typeof fakeClient>
beforeEach(() => {
  calls = fakeClient()
})
afterEach(() => resetSessions())

describe('opening seeds', () => {
  it('opens a tab, reports it and saves it', async () => {
    const opened = openSeed({ seed: 'AAA-AAA-AAA' })
    expect(findSession('AAA-AAA-AAA')?.status).toBe('loading')
    expect(calls[0]?.request).toEqual({ seed: 'AAA-AAA-AAA' })
    calls[0]?.resolve(report('AAA-AAA-AAA'))
    await opened
    expect(findSession('AAA-AAA-AAA')?.status).toBe('ready')
    expect($activeSeedId.get()).toBe('AAA-AAA-AAA')
    expect($savedSeeds.get()).toEqual([{ seed: 'AAA-AAA-AAA' }])
  })

  it('asks with the hand-off context, the query challenges included', async () => {
    const query = {
      challenges: ['on_diet' as const],
      requirements: [{ kind: 'ring' as const }],
    }
    void openSeed({ seed: 'AAA-AAA-AAB', query, trinket: 'none' })
    expect(calls[0]?.request).toEqual({
      seed: 'AAA-AAA-AAB',
      query,
      trinket: 'none',
      challenges: ['on_diet'],
    })
  })

  it('focuses an open seed instead of reporting it again', async () => {
    const first = openSeed({ seed: 'AAA-AAA-AAA' })
    calls[0]?.resolve(report('AAA-AAA-AAA'))
    await first
    void openSeed({ seed: 'AAA-AAA-AAB' })
    await openSeed({ seed: 'aaa-aaa-aaa' })
    expect($activeSeedId.get()).toBe('AAA-AAA-AAA')
    expect(calls).toHaveLength(2)
  })

  it('reports an open seed again when Find hands it over with a new context', async () => {
    const first = openSeed({ seed: 'AAA-AAA-AAA' })
    calls[0]?.resolve(report('AAA-AAA-AAA'))
    await first
    void openSeed({ seed: 'AAA-AAA-AAA', trinket: 'mimic_tooth' })
    expect(calls[1]?.request).toEqual({
      seed: 'AAA-AAA-AAA',
      trinket: 'mimic_tooth',
    })
    // The previous report stays on screen while the new one loads.
    expect(findSession('AAA-AAA-AAA')?.report?.seed.code).toBe('AAA-AAA-AAA')
  })

  it('drops an earlier trinket and challenges when re-opened with a new query', async () => {
    const first = openSeed({
      seed: 'AAA-AAA-AAA',
      query: { challenges: ['on_diet'], requirements: [] },
    })
    calls[0]?.resolve(report('AAA-AAA-AAA'))
    await first
    const picked = selectTrinket('AAA-AAA-AAA', 'mimic_tooth')
    calls[1]?.resolve(report('AAA-AAA-AAA'))
    await picked
    const query = { requirements: [{ kind: 'ring' as const }] }
    void openSeed({ seed: 'AAA-AAA-AAA', query })
    expect(calls[2]?.request).toEqual({ seed: 'AAA-AAA-AAA', query })
    expect($savedSeeds.get()).toEqual([{ seed: 'AAA-AAA-AAA', query }])
  })

  it(`keeps at most ${MAX_OPEN_SEEDS} tabs, dropping the oldest`, () => {
    for (let index = 0; index <= MAX_OPEN_SEEDS; index++) {
      void openSeed({ seed: `AAA-AAA-AA${String.fromCharCode(65 + index)}` })
    }
    expect(ids()).toHaveLength(MAX_OPEN_SEEDS)
    expect(ids()[0]).toBe('AAA-AAA-AAB')
    expect(calls[0]?.cancelled).toBe(true)
  })

  it('shows the engine message when a report fails', async () => {
    const opened = openSeed({ seed: '2026-13-45' })
    calls[0]?.reject(new Error('daily date must be a real YYYY-MM-DD date'))
    await opened
    expect(findSession('2026-13-45')).toMatchObject({
      status: 'error',
      error: 'daily date must be a real YYYY-MM-DD date',
    })
  })
})

describe('tab actions', () => {
  it('closes a tab and activates its right neighbour, else the left', () => {
    for (const seed of ['AAA-AAA-AAA', 'AAA-AAA-AAB', 'AAA-AAA-AAC']) {
      void openSeed({ seed })
    }
    $activeSeedId.set('AAA-AAA-AAB')
    closeSession('AAA-AAA-AAB')
    expect($activeSeedId.get()).toBe('AAA-AAA-AAC')
    closeSession('AAA-AAA-AAC')
    expect($activeSeedId.get()).toBe('AAA-AAA-AAA')
    expect($savedSeeds.get()).toEqual([{ seed: 'AAA-AAA-AAA' }])
  })

  it('cancels a loading report', async () => {
    const opened = openSeed({ seed: 'AAA-AAA-AAA' })
    cancelReport('AAA-AAA-AAA')
    await opened
    expect(calls[0]?.cancelled).toBe(true)
    expect(findSession('AAA-AAA-AAA')?.status).toBe('cancelled')
  })

  it('regenerates with a trinket and keeps the old report meanwhile', async () => {
    const opened = openSeed({ seed: 'AAA-AAA-AAA' })
    calls[0]?.resolve(report('AAA-AAA-AAA'))
    await opened
    const picked = selectTrinket('AAA-AAA-AAA', 'none')
    expect(calls[1]?.request).toEqual({ seed: 'AAA-AAA-AAA', trinket: 'none' })
    expect(findSession('AAA-AAA-AAA')).toMatchObject({ status: 'loading' })
    expect(findSession('AAA-AAA-AAA')?.report).not.toBeNull()
    calls[1]?.resolve(report('AAA-AAA-AAA'))
    await picked
    expect($savedSeeds.get()).toEqual([
      { seed: 'AAA-AAA-AAA', trinket: 'none' },
    ])
  })

  it('replaces the active tab in place for result navigation', () => {
    void openSeed({ seed: 'AAA-AAA-AAA' })
    void openSeed({ seed: 'AAA-AAA-AAB' })
    $activeSeedId.set('AAA-AAA-AAA')
    void replaceActiveSeed({ seed: 'AAA-AAA-AAC', trinket: 'none' })
    expect(ids()).toEqual(['AAA-AAA-AAC', 'AAA-AAA-AAB'])
    expect($activeSeedId.get()).toBe('AAA-AAA-AAC')
    // A seed open in another tab is focused, not duplicated.
    void replaceActiveSeed({ seed: 'AAA-AAA-AAB' })
    expect(ids()).toEqual(['AAA-AAA-AAC', 'AAA-AAA-AAB'])
    expect($activeSeedId.get()).toBe('AAA-AAA-AAB')
  })
})

describe('restoring', () => {
  it('reopens the saved tabs, reporting the active one first', async () => {
    $savedSeeds.set([
      { seed: 'AAA-AAA-AAA' },
      { seed: 'AAA-AAA-AAB', trinket: 'none' },
    ])
    $activeSeedId.set('AAA-AAA-AAB')
    const restored = restoreSessions()
    expect(ids()).toEqual(['AAA-AAA-AAA', 'AAA-AAA-AAB'])
    expect(calls[0]?.request).toEqual({ seed: 'AAA-AAA-AAB', trinket: 'none' })
    calls[0]?.resolve(report('AAA-AAA-AAB'))
    await Bun.sleep(0)
    expect(calls[1]?.request).toEqual({ seed: 'AAA-AAA-AAA' })
    calls[1]?.resolve(report('AAA-AAA-AAA'))
    await restored
    expect(findSession('AAA-AAA-AAA')?.status).toBe('ready')
  })
})
