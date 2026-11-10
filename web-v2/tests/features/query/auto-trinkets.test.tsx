import { beforeAll, expect, it } from 'bun:test'
import {
  decode_share_text,
  encode_share_link,
  filter_seeds,
  parse_seed_code,
  SearchSession,
} from '../../../src/engine/pkg/seedfinder.js'
import type { ParsedSeed, SearchAdvance } from '../../../src/engine/types'
import { fromQueryJson, toQueryJson } from '../../../src/features/query/query'
import { loadEngine, reportOf } from '../../engine/engine'

beforeAll(loadEngine)

const document = {
  auto_apply_trinket: true,
  max_depth: 19,
  requirements: [{ kind: 'weapon', effect: 'Grim' }],
}
const seedOf = (code: string) => JSON.parse(parse_seed_code(code)) as ParsedSeed
const filtered = (
  query: string,
  seed: ParsedSeed,
  trinkets: string,
  base?: string
) =>
  JSON.parse(
    filter_seeds(query, new Float64Array([seed.value]), trinkets, base)
  )

/** The one-seed search for `query` on `seed`. */
function searchOne(query: string, seed: ParsedSeed): SearchAdvance {
  const session = new SearchSession(query, seed.value, seed.value + 1)
  try {
    return JSON.parse(session.advance(1)) as SearchAdvance
  } finally {
    session.free()
  }
}

it('keeps the setting in share links and rejects malformed flags', () => {
  const state = fromQueryJson(JSON.stringify(document))
  const link = encode_share_link(toQueryJson(state))
  expect(fromQueryJson(decode_share_text(link))).toEqual(state)
  expect(() =>
    fromQueryJson('{"requirements":[],"auto_apply_trinket":"yes"}')
  ).toThrow(/boolean/)
  expect(fromQueryJson('{"requirements":[]}').autoApplyTrinket).toBe(false)
})

it('keeps a necessary trinket and replays its recipe in Analyze and filtering', () => {
  const json = JSON.stringify(document)
  const seed = seedOf('SRU-YSU-QHS')
  const found = searchOne(json, seed)
  expect(found.tested).toBe(1)
  expect(found.state).toBe('completed')
  expect(found.matches).toEqual([
    { ...seed, selectedTrinket: 'parchment_scrap' },
  ])
  const report = reportOf({
    seed: seed.code,
    query: document,
    trinket: 'parchment_scrap',
  })
  expect(report.trinkets.selected).toBe('parchment_scrap')
  expect(report.query?.matchedRequirements).toBe(1)
  expect(filtered(json, seed, '["parchment_scrap"]')).toEqual(found.matches)
  expect(filtered(json, seed, '[null]')).toEqual([])
})

it('keeps a helpful Mimic Tooth while Sundial waits at the first transmutation', () => {
  const query = {
    auto_apply_trinket: true,
    max_depth: 19,
    requirements: [
      { item: 'dimensional_sundial', trinket_transmutations: 1 },
      { kind: 'melee_weapon', source: 'golden_mimic' },
    ],
  }
  const json = JSON.stringify(query)
  const seed = seedOf('AAA-AAA-AAN')
  const found = searchOne(json, seed)
  expect(found.matches).toEqual([{ ...seed, selectedTrinket: 'mimic_tooth' }])
  // Without a trinket of its own, Analyze picks the one the query needs.
  const report = reportOf({ seed: seed.code, query })
  expect(report.trinkets.selected).toBe('mimic_tooth')
  expect(report.query?.matchedRequirements).toBe(2)
  expect(report.trinkets.transmutationOrder[0]).toMatchObject({
    id: 'dimensional_sundial',
    matched: true,
  })
  expect(filtered(json, seed, '["mimic_tooth"]')).toEqual(found.matches)
  expect(filtered(json, seed, '[null]')).toEqual([])
  const onlyTrinket = JSON.stringify({
    ...query,
    requirements: query.requirements.slice(0, 1),
  })
  expect(filtered(onlyTrinket, seed, '["mimic_tooth"]', json)).toEqual([
    { ...seed, selectedTrinket: null },
  ])
})

it('removes an unnecessary trinket and restores it when a refined query needs it', () => {
  const json = JSON.stringify(document)
  const seed = seedOf('EYY-RUL-LQG')
  const found = searchOne(json, seed)
  expect(found.matches).toEqual([{ ...seed, selectedTrinket: null }])
  const report = reportOf({ seed: seed.code, query: document, trinket: 'none' })
  expect(report.trinkets.selected).toBeNull()
  expect(report.query?.matchedRequirements).toBe(1)
  const narrowed = JSON.stringify({
    ...document,
    requirements: [
      ...document.requirements,
      { item: 'whip', effect: 'Venomous' },
    ],
  })
  expect(filtered(narrowed, seed, '[null]')).toEqual([])
  expect(filtered(narrowed, seed, '[null]', json)).toEqual([
    { ...seed, selectedTrinket: 'parchment_scrap' },
  ])
  const selected = reportOf({
    seed: seed.code,
    query: JSON.parse(narrowed),
    trinket: 'parchment_scrap',
  })
  expect(selected.query?.matchedRequirements).toBe(2)
  expect(filtered(json, seed, '["parchment_scrap"]', narrowed)).toEqual(
    found.matches
  )
})

it('returns explicit no-trinket recipes when the offers cannot help', () => {
  const query = JSON.stringify({
    auto_apply_trinket: true,
    max_depth: 2,
    requirements: [{ item: 'leather_armor', upgrade: 1 }],
  })
  const session = new SearchSession(query, 0, 64)
  try {
    const found = JSON.parse(session.advance(64)) as SearchAdvance
    expect(found.matches.length).toBeGreaterThan(0)
    expect(found.matches.every((match) => match.selectedTrinket === null)).toBe(
      true
    )
    const replay = JSON.parse(
      filter_seeds(
        query,
        new Float64Array(found.matches.map((match) => match.value)),
        JSON.stringify(found.matches.map(() => null))
      )
    )
    expect(replay).toEqual(found.matches)
  } finally {
    session.free()
  }
})
