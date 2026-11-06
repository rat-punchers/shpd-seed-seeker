import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { $query, setQuery } from '../../../src/app/store/query'
import { toSimple } from '../../../src/features/find/simple'
import {
  addSimpleRow,
  clearQuery,
  removeSimpleRow,
  setMatchMode,
  setRowDepth,
  setRowItem,
  setRowKind,
  setRowUpgrade,
} from '../../../src/features/find/simple-edit'
import {
  defaultQueryState,
  toQueryDocument,
} from '../../../src/features/query/query'
import { initialCoordinatorState } from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'

const simple = () => {
  const view = toSimple($query.get())
  if (!view) throw new Error('the query left the Simple view')
  return view
}
const keys = () => simple().constraints.map((row) => row.key)

beforeEach(() => {
  searchStore.setState(() => initialCoordinatorState())
  setQuery(defaultQueryState())
})
afterEach(() => {
  searchStore.setState(() => initialCoordinatorState())
  localStorage.clear()
})

describe('rows', () => {
  it('adds a Ring of Wealth row by floor 4 to an empty query', () => {
    addSimpleRow()
    expect(simple()).toMatchObject({
      matchMode: 'all',
      maxDepth: 4,
      constraints: [{ kind: 'ring', item: 'ring_wealth' }],
    })
    expect(simple().constraints[0]?.maxDepth).toBeUndefined()
  })

  it('gives every new row a fresh key and the deepest row floor', () => {
    addSimpleRow()
    const [first = 0] = keys()
    setRowDepth(first, 12)
    addSimpleRow()
    removeSimpleRow(first)
    addSimpleRow()
    const fresh = keys()
    expect(new Set(fresh).size).toBe(2)
    expect(fresh).not.toContain(first)
    expect(simple().maxDepth).toBe(12)
  })

  it('makes the deepest row the query floor limit', () => {
    addSimpleRow()
    addSimpleRow()
    const [first = 0, second = 0] = keys()
    setRowDepth(first, 9)
    setRowDepth(second, 2)
    expect(simple().maxDepth).toBe(9)
    expect(simple().constraints.map((row) => row.maxDepth)).toEqual([
      undefined,
      2,
    ])
    expect(toQueryDocument($query.get())).toMatchObject({
      max_depth: 9,
      requirements: [
        { kind: 'ring', item: 'ring_wealth' },
        { kind: 'ring', item: 'ring_wealth', max_depth: 2 },
      ],
    })
    // Removing the deepest row hands the limit to the rows that remain.
    removeSimpleRow(first)
    expect(simple()).toMatchObject({
      maxDepth: 2,
      constraints: [{ key: second }],
    })
    expect(simple().constraints[0]?.maxDepth).toBeUndefined()
  })

  it('writes "Match any" as one group and back', () => {
    addSimpleRow()
    addSimpleRow()
    setMatchMode('any')
    expect(simple().matchMode).toBe('any')
    expect(toQueryDocument($query.get()).requirements).toHaveLength(1)
    setMatchMode('all')
    expect(toQueryDocument($query.get()).requirements).toHaveLength(2)
  })
})

describe('row fields', () => {
  let key = 0
  beforeEach(() => {
    addSimpleRow()
    key = keys()[0] ?? 0
  })
  const row = () => simple().constraints[0]

  it('drops the item on a kind change, keeping a still-valid upgrade', () => {
    setRowUpgrade(key, 3)
    setRowKind(key, 'wand')
    expect(row()).toMatchObject({ kind: 'wand', minUpgrade: 3 })
    expect(row()?.item).toBeUndefined()
  })

  it('picks the first item for kinds the engine searches by name only', () => {
    setRowKind(key, 'trinket')
    expect(row()).toMatchObject({ kind: 'trinket', item: 'chaotic_censer' })
    setRowKind(key, 'artifact')
    expect(row()?.item).toBeDefined()
  })

  it('drops an upgrade the new item cannot reach', () => {
    setRowKind(key, 'melee_weapon')
    setRowUpgrade(key, 5)
    setRowItem(key, 'longsword')
    expect(row()?.minUpgrade).toBe(5)
    setRowItem(key, 'sword')
    expect(row()?.minUpgrade).toBeUndefined()
  })

  it('clears the item back to any', () => {
    setRowItem(key, undefined)
    expect(row()).toEqual({ key, kind: 'ring' })
  })
})

it('refuses edits while a search runs', () => {
  addSimpleRow()
  const before = $query.get()
  searchStore.setState((state) => ({ ...state, state: 'running' }))
  addSimpleRow()
  setMatchMode('any')
  clearQuery()
  expect($query.get()).toBe(before)
})

it('clears an Advanced query back to the empty Simple query', () => {
  setQuery({ ...defaultQueryState(), requireBlacksmith: true })
  expect(toSimple($query.get())).toBeNull()
  clearQuery()
  expect(simple()).toEqual({ matchMode: 'all', maxDepth: 24, constraints: [] })
})
