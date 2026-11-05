import { describe, expect, it } from 'bun:test'
import type { QueryState, RequirementState } from '../../../src/engine/types'
import {
  fromSimple,
  isSimpleRepresentable,
  type SimpleQuery,
  toSimple,
} from '../../../src/features/find/simple'
import {
  defaultQueryState,
  fromQueryJson,
  toQueryDocument,
  toQueryJson,
} from '../../../src/features/query/query'
import { normalizedQuery } from '../../../src/features/query/requirements/board'

const allOf: SimpleQuery = {
  matchMode: 'all',
  maxDepth: 14,
  constraints: [
    { key: 1, kind: 'ring', item: 'ring_wealth', minUpgrade: 2 },
    { key: 2, kind: 'wand', item: 'wand_disintegration', maxDepth: 9 },
    { key: 3, kind: 'thrown_weapon', minUpgrade: 0 },
    { key: 4, kind: 'armor', minUpgrade: 3, maxDepth: 4 },
  ],
}
const anyOf: SimpleQuery = { ...allOf, matchMode: 'any' }
const single: SimpleQuery = {
  matchMode: 'all',
  maxDepth: 24,
  constraints: [{ key: 1, kind: 'artifact', item: 'dried_rose' }],
}
const empty: SimpleQuery = { matchMode: 'all', maxDepth: 24, constraints: [] }

/** A query document read back, as a saved query or share link restores it. */
const reloaded = (query: QueryState): QueryState =>
  fromQueryJson(toQueryJson(query))

describe('fromSimple and toSimple', () => {
  it.each([
    ['match all', allOf],
    ['match any', anyOf],
    ['a single row', single],
    ['no rows', empty],
  ])('round trip %s', (_, simple) => {
    const query = fromSimple(simple)
    expect(isSimpleRepresentable(query)).toBe(true)
    expect(toSimple(query)).toEqual(simple)
    expect(toSimple(reloaded(query))).toEqual(simple)
  })

  it('writes "Match any" as one any_of group', () => {
    const document = toQueryDocument(fromSimple(anyOf))
    expect(document.requirements).toHaveLength(1)
    expect(document.requirements[0]).toEqual({
      any_of: [
        { kind: 'ring', item: 'ring_wealth', upgrade: { at_least: 2 } },
        { kind: 'wand', item: 'wand_disintegration', max_depth: 9 },
        { kind: 'thrown_weapon', upgrade: { at_least: 0 } },
        { kind: 'armor', upgrade: { at_least: 3 }, max_depth: 4 },
      ],
    })
    expect(document.max_depth).toBe(14)
  })

  it('writes "Match all" as separate requirements', () => {
    const document = toQueryDocument(fromSimple(allOf))
    expect(document.requirements).toHaveLength(4)
    expect(document.requirements.some((entry) => 'any_of' in entry)).toBe(false)
  })

  it('reads one "Match any" row as "Match all"', () => {
    const query = fromSimple({ ...single, matchMode: 'any' })
    expect(query.requirements[0]?.alternativeGroup).toBeUndefined()
    expect(toSimple(query)?.matchMode).toBe('all')
  })

  it.each([
    ['match all', allOf],
    ['match any', anyOf],
    ['a single row', single],
  ])('writes %s in the editor canonical form', (_, simple) => {
    const query = fromSimple(simple)
    expect(normalizedQuery(query)).toBe(query)
    expect(normalizedQuery(reloaded(query)).requirements).toEqual(
      reloaded(query).requirements
    )
  })

  it('keeps row keys', () => {
    const query = fromSimple(allOf)
    expect(query.requirements.map((row) => row.key)).toEqual([1, 2, 3, 4])
  })
})

describe('isSimpleRepresentable', () => {
  const base = fromSimple(allOf)
  const withRow = (patch: Partial<RequirementState>): QueryState => ({
    ...base,
    requirements: base.requirements.map((row, index) =>
      index === 0 ? { ...row, ...patch } : row
    ),
  })
  const withQuery = (patch: Partial<QueryState>): QueryState => ({
    ...base,
    ...patch,
  })

  it('accepts the default query', () => {
    expect(isSimpleRepresentable(defaultQueryState())).toBe(true)
  })

  it.each<[string, QueryState]>([
    ['an effect', withRow({ kind: 'weapon', effect: 'Blazing' })],
    ['any enchantment', withRow({ kind: 'armor', effect: 'any_enchantment' })],
    ['a tier', withRow({ tier: { mode: 'at_least', value: 4 } })],
    ['an exact upgrade', withRow({ upgrade: { mode: 'exact', value: 3 } })],
    ['a blanket', withRow({ blanket: true })],
    ['uncursed', withRow({ uncursed: true })],
    ['a source', withRow({ source: 'shop' })],
    ['an identity group', withRow({ identityGroup: 1 })],
    ['a resin exclusion', withRow({ excludeResin: true })],
    ['selectTrinket', withRow({ kind: 'trinket', selectTrinket: true })],
    [
      'trinket transmutations',
      withRow({ kind: 'trinket', trinketTransmutations: 2 }),
    ],
    [
      'artifact transmutations',
      withRow({ kind: 'artifact', artifactTransmutations: 2 }),
    ],
    ['a levelSum', withRow({ levelSum: { group: 1, atLeast: 4 } })],
    ['no kind or item', withRow({ kind: undefined, item: undefined })],
    ['Arcane Resin', withQuery({ arcaneResin: 'auto' })],
    [
      'a resin donor filter',
      withQuery({ arcaneResinFilter: { uncursed: false } }),
    ],
    [
      'a floor requirement',
      withQuery({ floorRequirements: [{ depth: 7, feeling: 'dark' }] }),
    ],
    ['a Wandmaker quest', withQuery({ wandmakerQuest: 'corpse_dust' })],
    ['require Blacksmith', withQuery({ requireBlacksmith: true })],
    [
      'exclude Blacksmith rewards',
      withQuery({ excludeBlacksmithRewards: true }),
    ],
    ['a challenge', withQuery({ challenges: ['barren_land'] })],
    ['AutoTrinket off', withQuery({ autoApplyTrinket: false })],
    [
      'an any_of group beside a plain row',
      withQuery({
        requirements: base.requirements.map((row, index) =>
          index < 2 ? { ...row, alternativeGroup: 1 } : row
        ),
      }),
    ],
    [
      'two any_of groups',
      withQuery({
        requirements: base.requirements.map((row, index) => ({
          ...row,
          alternativeGroup: index < 2 ? 1 : 2,
        })),
      }),
    ],
  ])('rejects %s', (_, query) => {
    expect(isSimpleRepresentable(query)).toBe(false)
    expect(toSimple(query)).toBeNull()
  })

  it('reads an item-only row with its item kind', () => {
    const query = withRow({ kind: undefined })
    expect(isSimpleRepresentable(query)).toBe(true)
    expect(toSimple(query)?.constraints[0]?.kind).toBe('ring')
  })
})
