import { $query, setQuery } from '../../app/store/query'
import type { RequirementKind } from '../../engine/types'
import { defaultQueryState } from '../query/query'
import { nextKeyHint, noteNextKey } from '../query/requirements/board'
import { anySearchActive } from '../search/tabs'
import {
  fromSimple,
  type MatchMode,
  type SimpleConstraint,
  type SimpleQuery,
  toSimple,
} from './simple'
import { DEFAULT_ROW_DEPTH, upgradeLevels } from './simple-items'

/** The most rows Simple offers; Advanced has no such cap. */
export const MAX_SIMPLE_ROWS = 32

/** The floor a row searches to: its own limit, else the query's. */
export const rowDepth = (simple: SimpleQuery, row: SimpleConstraint): number =>
  row.maxDepth ?? simple.maxDepth

/**
 * Writes each row's floor as Simple shows it: the query's floor limit is the
 * deepest row, and a row keeps a limit of its own only when it stops earlier.
 */
function withDepths(
  simple: SimpleQuery,
  depths: ReadonlyMap<number, number> = new Map()
): SimpleQuery {
  if (simple.constraints.length === 0) return simple
  const depthOf = (row: SimpleConstraint) =>
    depths.get(row.key) ?? rowDepth(simple, row)
  const maxDepth = Math.max(...simple.constraints.map(depthOf))
  return {
    ...simple,
    maxDepth,
    constraints: simple.constraints.map((row) => {
      const { maxDepth: _, ...rest } = row
      const depth = depthOf(row)
      return depth < maxDepth ? { ...rest, maxDepth: depth } : rest
    }),
  }
}

/** Applies a Simple edit to the saved query. Refused while a search runs. */
function editSimple(change: (simple: SimpleQuery) => SimpleQuery): void {
  if (anySearchActive()) return
  const simple = toSimple($query.get())
  if (!simple) return
  setQuery(fromSimple(change(simple)))
}

export function addSimpleRow(): void {
  editSimple((simple) => {
    if (simple.constraints.length >= MAX_SIMPLE_ROWS) return simple
    const key = Math.max(
      nextKeyHint(),
      ...simple.constraints.map((row) => row.key + 1)
    )
    noteNextKey(key + 1)
    const depth = simple.constraints.length
      ? Math.max(...simple.constraints.map((row) => rowDepth(simple, row)))
      : DEFAULT_ROW_DEPTH
    const row: SimpleConstraint = { key, kind: 'ring', item: 'ring_wealth' }
    return withDepths(
      { ...simple, constraints: [...simple.constraints, row] },
      new Map([[key, depth]])
    )
  })
}

export function removeSimpleRow(key: number): void {
  editSimple((simple) =>
    withDepths(
      {
        ...simple,
        constraints: simple.constraints.filter((row) => row.key !== key),
      },
      // The removed row may have set the floor limit; the rest keep theirs.
      new Map(simple.constraints.map((row) => [row.key, rowDepth(simple, row)]))
    )
  )
}

const keptUpgrade = (
  kind: RequirementKind,
  item: string | undefined,
  minUpgrade: number | undefined
): number | undefined =>
  minUpgrade !== undefined && upgradeLevels(kind, item).includes(minUpgrade)
    ? minUpgrade
    : undefined

function editRow(
  key: number,
  change: (row: SimpleConstraint) => SimpleConstraint
): void {
  editSimple((simple) => ({
    ...simple,
    constraints: simple.constraints.map((row) =>
      row.key === key ? change(row) : row
    ),
  }))
}

/** Picks a kind and item together, keeping the upgrade where it still fits. */
export function setRowChoice(
  key: number,
  kind: RequirementKind,
  item: string | undefined
): void {
  editRow(key, ({ item: _, minUpgrade, ...row }) => {
    const upgrade = keptUpgrade(kind, item, minUpgrade)
    return {
      ...row,
      kind,
      ...(item ? { item } : {}),
      ...(upgrade !== undefined ? { minUpgrade: upgrade } : {}),
    }
  })
}

export function setRowUpgrade(
  key: number,
  minUpgrade: number | undefined
): void {
  editRow(key, ({ minUpgrade: _, ...row }) =>
    minUpgrade === undefined ? row : { ...row, minUpgrade }
  )
}

export function setRowDepth(key: number, depth: number): void {
  editSimple((simple) => withDepths(simple, new Map([[key, depth]])))
}

export function setMatchMode(matchMode: MatchMode): void {
  editSimple((simple) => ({ ...simple, matchMode }))
}

/** Replaces the saved query with an empty one, from any view. */
export function clearQuery(): void {
  if (anySearchActive()) return
  setQuery(defaultQueryState())
}
