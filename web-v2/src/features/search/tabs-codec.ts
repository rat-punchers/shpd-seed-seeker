import type { ParsedSeed, QueryDocument } from '../../engine/types'
import {
  type CoordinatorState,
  initialCoordinatorState,
  isSearchActive,
  runSaturated,
  settleRun,
  type TargetState,
} from './coordinator-state'

/** One results set: Find's search state, named "Results #id". */
export interface ResultsTab {
  id: number
  search: CoordinatorState
}

export interface ResultsTabs {
  tabs: ResultsTab[]
  activeId: number
  /** Ids are never reused, so an Analyze tab keeps pointing at its set. */
  nextId: number
}

/** A Target's per-seed sources, grouped: the same query repeats per seed. */
interface StoredSources {
  queries: QueryDocument[]
  values: number[][]
}

interface StoredTarget {
  query: QueryDocument
  matches: ParsedSeed[]
  sources?: StoredSources
}

type StoredSearch = Omit<CoordinatorState, 'rateSamples' | 'target'> & {
  target?: StoredTarget
}

interface StoredTabs {
  version: 1
  activeId: number
  nextId: number
  tabs: { id: number; search: StoredSearch }[]
}

function groupSources(sources: Record<number, QueryDocument>): StoredSources {
  const groups = new Map<string, { query: QueryDocument; values: number[] }>()
  for (const [value, query] of Object.entries(sources)) {
    const key = JSON.stringify(query)
    const group = groups.get(key) ?? { query, values: [] }
    group.values.push(Number(value))
    groups.set(key, group)
  }
  return {
    queries: [...groups.values()].map((group) => group.query),
    values: [...groups.values()].map((group) => group.values),
  }
}

function ungroupSources(stored: StoredSources): Record<number, QueryDocument> {
  const sources: Record<number, QueryDocument> = {}
  stored.queries.forEach((query, index) => {
    for (const value of stored.values[index] ?? []) sources[value] = query
  })
  return sources
}

function storedSearch(search: CoordinatorState): StoredSearch {
  const { rateSamples: _samples, target, ...rest } = search
  if (!target) return rest
  const { sources, ...pool } = target
  return {
    ...rest,
    target: sources ? { ...pool, sources: groupSources(sources) } : pool,
  }
}

/**
 * A saved search as the page finds it after a reload. The workers that ran
 * it are gone, so a running search becomes cancelled with the coverage it
 * last saved, and Find resumes from there. A refine caught re-verifying its
 * previous results never touched them, so they stand as they were.
 */
function restoredSearch(stored: StoredSearch): CoordinatorState {
  const { target, ...rest } = stored
  const search: CoordinatorState = {
    ...initialCoordinatorState(),
    ...rest,
    rateSamples: [],
    rate: 0,
    startedAt: 0,
    ...(target ? { target: restoredTarget(target) } : {}),
  }
  if (search.filtering) {
    const kept = search.target !== undefined || search.matches.length > 0
    return {
      ...search,
      filtering: false,
      refined: undefined,
      state: kept ? 'cancelled' : 'idle',
    }
  }
  if (!isSearchActive(search)) return search
  return settleRun({
    ...search,
    state: runSaturated(search) ? 'completed' : 'cancelled',
  })
}

function restoredTarget(stored: StoredTarget): TargetState {
  const { sources, ...pool } = stored
  return sources ? { ...pool, sources: ungroupSources(sources) } : pool
}

export function encodeTabs(state: ResultsTabs): string {
  return JSON.stringify({
    version: 1,
    activeId: state.activeId,
    nextId: state.nextId,
    tabs: state.tabs.map((tab) => ({
      id: tab.id,
      search: storedSearch(tab.search),
    })),
  } satisfies StoredTabs)
}

const isStoredTab = (tab: unknown): tab is StoredTabs['tabs'][number] =>
  typeof tab === 'object' &&
  tab !== null &&
  Number.isInteger((tab as { id: unknown }).id) &&
  typeof (tab as { search: unknown }).search === 'object' &&
  (tab as { search: unknown }).search !== null

/** The saved tabs, or undefined when the text is not a saved tab set. */
export function decodeTabs(text: string): ResultsTabs | undefined {
  try {
    const parsed = JSON.parse(text) as Partial<StoredTabs>
    if (parsed.version !== 1 || !Array.isArray(parsed.tabs)) return undefined
    const tabs = parsed.tabs.filter(isStoredTab).map((tab) => ({
      id: tab.id,
      search: restoredSearch(tab.search),
    }))
    const first = tabs[0]
    if (!first) return undefined
    const ids = tabs.map((tab) => tab.id)
    return {
      tabs,
      activeId: ids.includes(parsed.activeId ?? -1)
        ? (parsed.activeId as number)
        : first.id,
      nextId: Math.max(parsed.nextId ?? 0, ...ids.map((id) => id + 1)),
    }
  } catch {
    return undefined
  }
}
