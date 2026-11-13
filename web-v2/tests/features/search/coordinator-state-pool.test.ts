import { describe, expect, it } from 'bun:test'
import {
  applyProgress,
  type CoordinatorState,
  importedResultsState,
  initialCoordinatorState,
  markWorkerDone,
  runSaturated,
  settleRun,
} from '../../../src/features/search/coordinator-state'

const match = (value: number) => ({
  value,
  code: value.toString().padStart(9, 'A'),
})

describe('persistent pool', () => {
  it('retains discoveries from every query, even if the run fails', () => {
    const a = { requirements: [{ kind: 'wand' as const }] }
    const b = { requirements: [{ kind: 'armor' as const }] }
    const first = settleRun({
      ...initialCoordinatorState(),
      query: a,
      matches: [match(1), match(2)],
      state: 'completed',
    })
    const second = settleRun({
      ...first,
      query: b,
      matches: [match(2), match(3)],
      state: 'failed',
    })
    expect(second.target?.matches.map((m) => m.value)).toEqual([1, 2, 3])
    expect(second.target?.sources?.[2]).toEqual(a)
    expect(second.target?.sources?.[3]).toEqual(b)
    const imported = importedResultsState(second, [match(4)], a)
    expect(imported.target?.matches.map((m) => m.value)).toEqual([1, 2, 3, 4])
    expect(imported.matches).toEqual([match(4)])
  })
})

describe('imported results as Target', () => {
  it('makes the imported query and seeds the Target with no coverage', () => {
    const state = importedResultsState(
      initialCoordinatorState(1_000),
      [match(5), match(6)],
      {
        requirements: [{ kind: 'wand' }],
      }
    )
    expect(state.target?.matches.map((item) => item.value)).toEqual([5, 6])
    expect(state.target?.query).toEqual({ requirements: [{ kind: 'wand' }] })
  })
})

describe('per-run accept quota', () => {
  it('keeps a refine running past the display cap until it adds a full quota of new finds', () => {
    // 1,024 survivors already fill the display; the resumed scan must still
    // run until it has found RESULT_CAP additional seeds.
    const survivors = Array.from({ length: 1_024 }, (_, value) => match(value))
    const base: CoordinatorState = {
      ...initialCoordinatorState(1_000_000),
      state: 'running',
      sessionId: 1,
      workerCount: 1,
      startedAt: 0,
      matches: survivors,
      sessionBaseline: survivors.length,
      capped: true,
    }
    const partial = applyProgress(base, {
      sessionId: 1,
      workerId: 0,
      scanned: [500],
      matches: Array.from({ length: 500 }, (_, value) => match(2_000 + value)),
      now: 1_000,
    })
    expect(partial.state).toBe('running')
    expect(runSaturated(partial)).toBe(false)

    const saturated = applyProgress(partial, {
      sessionId: 1,
      workerId: 0,
      scanned: [1_100],
      matches: Array.from({ length: 524 }, (_, value) => match(3_000 + value)),
      now: 2_000,
    })
    expect(runSaturated(saturated)).toBe(true)
    expect(saturated.state).toBe('stopping')
    expect(saturated.matches).toHaveLength(2_048)
  })

  it('still ends a fresh scan at the cap, whose baseline is zero', () => {
    const base: CoordinatorState = {
      ...initialCoordinatorState(1_000_000),
      state: 'running',
      sessionId: 1,
      workerCount: 1,
      startedAt: 0,
    }
    const updated = applyProgress(base, {
      sessionId: 1,
      workerId: 0,
      scanned: [5_000],
      matches: Array.from({ length: 1_024 }, (_, value) => match(value)),
      now: 1_000,
    })
    expect(updated.state).toBe('stopping')
  })
})

it('counts imported survivors toward the 1024 unique-match goal', () => {
  const survivors = Array.from({ length: 108 }, (_, value) => match(value))
  const state: CoordinatorState = {
    ...initialCoordinatorState(10000),
    state: 'running',
    sessionId: 1,
    workerCount: 1,
    matches: survivors,
    sessionBaseline: survivors.length,
  }
  const stillShort = applyProgress(state, {
    sessionId: 1,
    workerId: 0,
    scanned: [1000],
    matches: [
      ...survivors,
      ...Array.from({ length: 915 }, (_, value) => match(value + 108)),
    ],
    now: 1000,
  })
  expect(runSaturated(stillShort)).toBe(false)
  const full = applyProgress(stillShort, {
    sessionId: 1,
    workerId: 0,
    scanned: [1001],
    matches: [match(1023)],
    now: 1100,
  })
  expect(full.matches).toHaveLength(1024)
  expect(runSaturated(full)).toBe(true)
})

it('retains worker flushes after reaching the cap and after a failure', () => {
  const base: CoordinatorState = {
    ...initialCoordinatorState(10000),
    state: 'running',
    sessionId: 1,
    query: { requirements: [] },
    workerCount: 2,
  }
  const full = applyProgress(base, {
    sessionId: 1,
    workerId: 0,
    scanned: [1024],
    matches: Array.from({ length: 1024 }, (_, value) => match(value)),
    now: 1000,
  })
  expect(full.state).toBe('stopping')
  const flushed = applyProgress(full, {
    sessionId: 1,
    workerId: 1,
    scanned: [1],
    matches: [match(5000)],
    now: 1100,
  })
  expect(flushed.target?.matches).toHaveLength(1025)
  let done = markWorkerDone(flushed, {
    sessionId: 1,
    workerId: 0,
    scanned: [1024],
    kind: 'stopped',
    now: 1200,
  })
  done = markWorkerDone(done, {
    sessionId: 1,
    workerId: 1,
    scanned: [1],
    kind: 'stopped',
    now: 1200,
  })
  expect(done.state).toBe('completed')
  const failed = applyProgress(
    { ...base, state: 'failed' },
    {
      sessionId: 1,
      workerId: 1,
      scanned: [1],
      matches: [match(5000)],
      now: 1100,
    }
  )
  expect(failed.state).toBe('failed')
  expect(failed.target?.matches).toEqual([match(5000)])
})
