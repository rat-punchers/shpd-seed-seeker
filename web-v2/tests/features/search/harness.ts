import { afterAll, beforeAll, beforeEach, expect } from 'bun:test'
import type { QueryDocument } from '../../../src/engine/types'
import { searchStore } from '../../../src/features/search/coordinator'

/**
 * Enough of the Worker interface for the coordinator, which only constructs
 * workers and posts to them. Nothing answers unless a test does, so most
 * assertions are about the state the coordinator commits synchronously when a
 * search starts, which is exactly where the fresh/refine decision shows.
 */
interface StubMessage {
  type: string
  seeds?: number[]
  queryJson?: string
  baseQueryJson?: string
  segments?: { startSeed: number; endSeedExclusive: number }[]
  requestId?: number
}

export class StubWorker {
  /** Every message posted to any worker this test, in order. */
  static posted: StubMessage[] = []
  static listeners: ((event: MessageEvent) => void)[] = []
  addEventListener(
    _name: string,
    listener: (event: MessageEvent) => void
  ): void {
    StubWorker.listeners.push(listener)
  }
  postMessage(message: StubMessage): void {
    StubWorker.posted.push(message)
  }
  terminate(): void {}
}

/** Installs `StubWorker` as the global `Worker` for the calling test file. */
export function installStubWorkers(): void {
  const original = globalThis.Worker
  beforeAll(() => {
    Object.assign(globalThis, { Worker: StubWorker })
  })
  afterAll(() => {
    Object.assign(globalThis, { Worker: original })
  })
  beforeEach(() => {
    StubWorker.posted = []
    StubWorker.listeners = []
  })
}

export const postedTypes = () =>
  StubWorker.posted.map((message) => message.type)

/** Answers one filter request as worker 0 would. */
export function replyToFilter(
  filter: StubMessage | undefined,
  matches: ReturnType<typeof match>[]
): void {
  StubWorker.listeners[0]?.({
    data: {
      type: 'filter:result',
      requestId: filter?.requestId,
      resultJson: JSON.stringify(matches),
    },
  } as MessageEvent)
}

/** Polls `check` until it stops throwing, like `vi.waitFor`. */
export async function waitFor(check: () => void, timeout = 1_000) {
  const started = performance.now()
  for (;;) {
    try {
      check()
      return
    } catch (error) {
      if (performance.now() - started > timeout) throw error
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
  }
}

export const waitForFilter = () =>
  waitFor(() => expect(searchStore.state.filtering).toBe(false))

export const TOTAL = 1_000
export const baseQuery: QueryDocument = { requirements: [{ kind: 'ring' }] }
export const superset: QueryDocument = {
  requirements: [{ kind: 'ring' }, { kind: 'weapon' }],
}
export const unrelated: QueryDocument = { requirements: [{ kind: 'wand' }] }

export const match = (value: number) => ({
  value,
  code: value.toString().padStart(9, 'A'),
})

/** Leaves the store as a finished anchor run of `query` that covered the
 * first 400 of 1,000 seeds and found two matches, with the Target that
 * settleRun would have established from it. */
export function seedFinishedRun(
  query: QueryDocument,
  state: 'completed' | 'cancelled' = 'completed'
): void {
  searchStore.setState((current) => ({
    ...current,
    sessionId: 1,
    state,
    matches: [match(11), match(22)],
    queryJson: JSON.stringify(query),
    query,
    segments: [[{ startSeed: 0, endSeedExclusive: TOTAL }]],
    workerScanned: { 0: [400] },
    workerCount: 1,
    completedWorkers: 1,
    target: { query, matches: [match(11), match(22)] },
  }))
}
