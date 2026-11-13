import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { SeedReport } from '../../../src/engine/types'
import { scoutLinkSeed } from '../../../src/features/analyze/init'
import {
  resultPosition,
  stepActiveResult,
  stepResult,
  swipeDelta,
} from '../../../src/features/analyze/navigation'
import {
  $activeSeedId,
  $sessions,
  openSeed,
  resetSessions,
  setReportClient,
} from '../../../src/features/analyze/sessions'
import { initialCoordinatorState } from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'

const SEEDS = ['AAA-AAA-AAB', 'AAA-AAA-AAC', 'AAA-AAA-AAD']

describe('result position and steps', () => {
  it('locates a result and ignores other seeds', () => {
    expect(resultPosition(SEEDS, 'AAA-AAA-AAC')).toEqual({ index: 1, total: 3 })
    expect(resultPosition(SEEDS, 'ZZZ-ZZZ-ZZZ')).toBeUndefined()
    expect(resultPosition(SEEDS, undefined)).toBeUndefined()
  })

  it('steps within the list and stops at its ends', () => {
    expect(stepResult(SEEDS, 'AAA-AAA-AAB', 1)).toBe('AAA-AAA-AAC')
    expect(stepResult(SEEDS, 'AAA-AAA-AAC', -1)).toBe('AAA-AAA-AAB')
    expect(stepResult(SEEDS, 'AAA-AAA-AAD', 1)).toBeUndefined()
    expect(stepResult(SEEDS, 'AAA-AAA-AAB', -1)).toBeUndefined()
    expect(stepResult(SEEDS, 'ZZZ-ZZZ-ZZZ', 1)).toBeUndefined()
  })

  it('reads a long horizontal swipe as a step and anything else as a scroll', () => {
    const start = { x: 200, y: 300 }
    expect(swipeDelta(start, { x: 100, y: 310 })).toBe(1)
    expect(swipeDelta(start, { x: 300, y: 290 })).toBe(-1)
    expect(swipeDelta(start, { x: 170, y: 300 })).toBe(0)
    expect(swipeDelta(start, { x: 100, y: 400 })).toBe(0)
  })
})

describe('stepping the active tab through Find results', () => {
  const requests: unknown[] = []
  beforeEach(() => {
    requests.length = 0
    setReportClient((request) => {
      requests.push(request)
      return {
        promise: Promise.resolve({
          seed: { code: request.seed, value: 0, daily: false },
        } as SeedReport),
        cancel: () => {},
      }
    })
    searchStore.setState(() => ({
      ...initialCoordinatorState(),
      state: 'completed',
      query: { requirements: [{ kind: 'ring' }] },
      matches: SEEDS.map((code, value) => ({
        code,
        value,
        selectedTrinket: value === 1 ? null : 'mimic_tooth',
      })),
    }))
  })
  afterEach(() => {
    resetSessions()
    searchStore.setState(() => initialCoordinatorState())
  })

  it('replaces the active result with its neighbour and the search context', async () => {
    await openSeed({ seed: 'AAA-AAA-AAB', results: 1 })
    expect(stepActiveResult(-1)).toBe(false)
    expect(stepActiveResult(1)).toBe(true)
    expect(
      $sessions.get().map((session) => [session.id, session.seed])
    ).toEqual([['results-1', 'AAA-AAA-AAC']])
    expect($activeSeedId.get()).toBe('results-1')
    expect(requests.at(-1)).toEqual({
      seed: 'AAA-AAA-AAC',
      query: { requirements: [{ kind: 'ring' }] },
      trinket: 'none',
    })
  })

  it('opens another seed of the same results in the same tab', async () => {
    await openSeed({ seed: 'AAA-AAA-AAB', results: 1 })
    await openSeed({ seed: 'AAA-AAA-AAD', results: 1 })
    await openSeed({ seed: 'AAA-AAA-AAB' })
    expect(
      $sessions.get().map((session) => [session.id, session.seed])
    ).toEqual([
      ['results-1', 'AAA-AAA-AAD'],
      ['AAA-AAA-AAB', 'AAA-AAA-AAB'],
    ])
  })

  it('does nothing for a seed that is not a result or not from Find', async () => {
    await openSeed({ seed: 'ZZZ-ZZZ-ZZZ', results: 1 })
    expect(stepActiveResult(1)).toBe(false)
    await openSeed({ seed: 'AAA-AAA-AAB' })
    expect(stepActiveResult(1)).toBe(false)
  })
})

describe('?scout= links', () => {
  it('reads the seed from the query string', () => {
    expect(scoutLinkSeed('?scout=abc-def-ghi')).toBe('abc-def-ghi')
    expect(scoutLinkSeed('?scout=')).toBeUndefined()
    expect(scoutLinkSeed('')).toBeUndefined()
  })
})
