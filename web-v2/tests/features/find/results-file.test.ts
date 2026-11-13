import { beforeAll, describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { QueryState } from '../../../src/engine/types'
import {
  decodeResultsFile,
  encodeResultsFile,
  parsedSeedFromCode,
} from '../../../src/features/find/results/results-file'
import {
  defaultQueryState,
  toQueryDocument,
} from '../../../src/features/query/query'
import { loadEngine, REPO_ROOT } from '../../engine/engine'

// The results-file codec lives in the engine, so these are conformance tests
// against the real wasm module and the Rust core's frozen fixtures.
const fixture = (name: string) =>
  readFile(
    join(REPO_ROOT, 'crates/seedfinder-core/tests/fixtures', name),
    'utf8'
  )

let VERSION_1: string
let WANDMAKER_QUEST: string
let WEAPON_CATEGORIES: string

beforeAll(async () => {
  await loadEngine()
  VERSION_1 = await fixture('results-export-v1.json')
  WANDMAKER_QUEST = await fixture('results-export-wandmaker-quest.json')
  WEAPON_CATEGORIES = await fixture('results-export-v1-weapon-categories.json')
})

const loadedQuery: QueryState = {
  autoApplyTrinket: false,
  requirements: [
    {
      key: 1,
      kind: 'ring',
      item: 'ring_tenacity',
      tier: { mode: 'any', value: 3 },
      upgrade: { mode: 'exact', value: 4 },
      uncursed: false,
      source: 'imp_reward',
    },
    {
      key: 2,
      kind: 'wand',
      tier: { mode: 'any', value: 3 },
      upgrade: { mode: 'at_least', value: 2 },
      uncursed: true,
      identityGroup: 1,
      maxDepth: 9,
    },
  ],
  maxDepth: 12,
  requireBlacksmith: true,
  excludeBlacksmithRewards: false,
  challenges: ['barren_land'],
}

const file = (query: unknown, results: unknown[] = []) =>
  JSON.stringify({ format: 'seed-seeker-results', query, results })

describe('results file', () => {
  it('values a seed code through the engine seed parser', () => {
    expect(parsedSeedFromCode('AAA-AAA-AAA')).toEqual({
      code: 'AAA-AAA-AAA',
      value: 0,
    })
    expect(parsedSeedFromCode('AAA-AAA-AAB')).toEqual({
      code: 'AAA-AAA-AAB',
      value: 1,
    })
  })

  it('round-trips the query and seeds through encode and decode', () => {
    const text = encodeResultsFile(toQueryDocument(loadedQuery), [
      'AAA-AAA-BUH',
      'ABC-DEF-GHI',
    ])
    const decoded = decodeResultsFile(text)
    expect(decoded.appVersion).toBe('0.1.0')
    // A file written today carries the game version this engine targets.
    expect(decoded.shpdVersion).toBe('4.0.2')
    expect(decoded.query).toEqual(loadedQuery)
    expect(decoded.seeds).toEqual(['AAA-AAA-BUH', 'ABC-DEF-GHI'])
    expect(decoded.dropped).toBe(0)
  })

  it('always decodes the canonical frozen version-1 fixture', () => {
    const decoded = decodeResultsFile(VERSION_1)
    expect(decoded.appVersion).toBe('0.6.1')
    // The fixture keeps the version it was written under, not this engine's.
    expect(decoded.shpdVersion).toBe('3.3.8')
    expect(decoded.query).toEqual(loadedQuery)
    expect(decoded.seeds).toEqual(['AAA-AAA-BUH', 'ABC-DEF-GHI'])
  })

  it('accepts the narrowed weapon kinds and keeps them through a round-trip', () => {
    const decoded = decodeResultsFile(WEAPON_CATEGORIES)
    expect(
      decoded.query.requirements.map((requirement) => requirement.kind)
    ).toEqual(['thrown_weapon', 'melee_weapon', 'weapon'])
    expect(decoded.query.requirements[1]?.item).toBe('sword')
    expect(decoded.seeds).toEqual(['AAA-AAA-ACO'])
    const reEncoded = decodeResultsFile(
      encodeResultsFile(decoded.queryDocument, decoded.seeds)
    )
    expect(reEncoded.query).toEqual(decoded.query)
  })

  it('decodes and round-trips a Wandmaker quest', () => {
    const decoded = decodeResultsFile(WANDMAKER_QUEST)
    expect(decoded.query.wandmakerQuest).toBe('rotberry')
    expect(decoded.query.maxDepth).toBe(9)
    expect(decoded.seeds).toEqual(['AAA-AAA-BUH', 'ABC-DEF-GHI'])
    const quested: QueryState = {
      ...loadedQuery,
      wandmakerQuest: 'corpse_dust',
    }
    const text = encodeResultsFile(toQueryDocument(quested), ['AAA-AAA-BUH'])
    expect(decodeResultsFile(text).query).toEqual(quested)
  })

  it('ignores unknown envelope and per-result fields from future releases', () => {
    const decoded = decodeResultsFile(
      JSON.stringify({
        format: 'seed-seeker-results',
        format_version: 1,
        exported_at: '2031-01-01T00:00:00Z',
        future_minor_field: { nested: true },
        query: { requirements: [{ item: 'sword' }] },
        results: [{ seed: 'AAA-AAA-AAB', future_note: 'still fine' }],
      })
    )
    expect(decoded.seeds).toEqual(['AAA-AAA-AAB'])
    expect(decoded.query.maxDepth).toBe(24)
  })

  it('reports the engine dedupe-and-cap drop count', () => {
    const decoded = decodeResultsFile(
      file({ requirements: [{ item: 'sword' }] }, [
        { seed: 'AAA-AAA-AAC' },
        { seed: 'AAA-AAA-AAB' },
        { seed: 'AAA-AAA-AAC' },
      ])
    )
    expect(decoded.seeds).toEqual(['AAA-AAA-AAC', 'AAA-AAA-AAB'])
    expect(decoded.dropped).toBe(1)
  })

  it('surfaces the engine message for a malformed file', () => {
    for (const text of ['not json', '[]', '{}', '{"format":"other"}'])
      expect(() => decodeResultsFile(text)).toThrow(
        /not a Seed Seeker results file/i
      )
    expect(() =>
      decodeResultsFile(
        file({ requirements: [{ item: 'item_from_the_future' }] })
      )
    ).toThrow(/item_from_the_future/)
    expect(() =>
      decodeResultsFile(
        file({ requirements: [{ item: 'sword' }], wished_luck: 7 })
      )
    ).toThrow(/wished_luck/)
    expect(() =>
      decodeResultsFile(
        file({ requirements: [{ item: 'sword' }] }, [{ seed: 'aaa-aaa-aab' }])
      )
    ).toThrow(/result 1/i)
  })

  it('round-trips alternative groups, effect sets and combined levels', () => {
    const base = {
      tier: { mode: 'any' as const, value: 3 },
      upgrade: { mode: 'any' as const, value: 1 },
      uncursed: false,
    }
    const query: QueryState = {
      ...defaultQueryState(),
      requirements: [
        {
          ...base,
          key: 1,
          kind: 'weapon',
          item: 'spear',
          upgrade: { mode: 'exact', value: 3 },
          alternativeGroup: 1,
        },
        {
          ...base,
          key: 2,
          kind: 'thrown_weapon',
          item: 'shuriken',
          upgrade: { mode: 'exact', value: 2 },
          alternativeGroup: 1,
        },
        {
          ...base,
          key: 3,
          kind: 'weapon',
          item: 'greatshield',
          upgrade: { mode: 'exact', value: 2 },
          effect: ['Blocking', 'Projecting', 'Vampiric'],
        },
        {
          ...base,
          key: 4,
          kind: 'armor',
          effect: 'any_enchantment',
          uncursed: true,
        },
        {
          ...base,
          key: 5,
          kind: 'ring',
          item: 'ring_might',
          levelSum: { group: 2, atLeast: 4 },
        },
        {
          ...base,
          key: 6,
          kind: 'ring',
          item: 'ring_might',
          levelSum: { group: 2, atLeast: 4 },
        },
      ],
    }
    const decoded = decodeResultsFile(
      encodeResultsFile(toQueryDocument(query), ['AAA-AAA-BUH'])
    )
    expect(decoded.query).toEqual(query)
    expect(decoded.queryDocument).toEqual(toQueryDocument(query))
  })

  it('preserves each automatic recipe through export, import and duplicate removal', () => {
    const query = toQueryDocument({
      ...defaultQueryState(),
      autoApplyTrinket: true,
      requirements: [
        {
          key: 1,
          kind: 'weapon',
          item: 'runic_blade',
          tier: { mode: 'any', value: 3 },
          upgrade: { mode: 'exact', value: 1 },
          effect: 'Grim',
          uncursed: false,
        },
      ],
    })
    const text = encodeResultsFile(
      query,
      ['SRU-YSU-QHS', 'SRU-YSU-QHS'],
      ['parchment_scrap', null]
    )
    const decoded = decodeResultsFile(text)
    expect(decoded.query.autoApplyTrinket).toBe(true)
    expect(decoded.seeds).toEqual(['SRU-YSU-QHS'])
    expect(decoded.trinkets).toEqual(['parchment_scrap'])
    expect(decoded.dropped).toBe(1)
    expect(
      decodeResultsFile(encodeResultsFile(query, decoded.seeds, [null]))
        .trinkets
    ).toEqual([null])
    expect(() =>
      encodeResultsFile(query, decoded.seeds, ['runic_blade'])
    ).toThrow(/initial|offered/)
    expect(() => encodeResultsFile(query, decoded.seeds, [])).toThrow(
      /one choice per seed/
    )
  })
})
