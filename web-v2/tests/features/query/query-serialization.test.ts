import { describe, expect, it } from 'bun:test'
import type { QueryState, RequirementState } from '../../../src/engine/types'
import {
  defaultQueryState,
  FLOOR_LIMIT_OPTIONS,
  fromQueryJson,
  nearestOptionIndex,
  normalizeFloorLimit,
  toQueryJson,
} from '../../../src/features/query/query'

const row = (patch: Partial<RequirementState>): RequirementState => ({
  key: 1,
  tier: { mode: 'any', value: 3 },
  upgrade: { mode: 'any', value: 1 },
  uncursed: false,
  ...patch,
})

describe('query serialization', () => {
  it('omits wire defaults while retaining the enabled AutoTrinket setting', () => {
    expect(
      toQueryJson({
        ...defaultQueryState(),
        requirements: [row({ kind: 'wand' })],
      })
    ).toBe('{"requirements":[{"kind":"wand"}],"auto_apply_trinket":true}')
  })

  it('emits tier and upgrade wire forms exactly', () => {
    const state: QueryState = {
      ...defaultQueryState(),
      requirements: [
        row({
          kind: 'armor',
          tier: { mode: 'at_least', value: 4 },
          upgrade: { mode: 'at_least', value: 2 },
        }),
        row({
          key: 2,
          kind: 'ring',
          item: 'ring_haste',
          upgrade: { mode: 'exact', value: 4 },
        }),
      ],
      challenges: ['on_diet', 'into_darkness'],
    }
    expect(JSON.parse(toQueryJson(state))).toEqual({
      auto_apply_trinket: true,
      requirements: [
        { kind: 'armor', tier: { at_least: 4 }, upgrade: { at_least: 2 } },
        { kind: 'ring', item: 'ring_haste', upgrade: 4 },
      ],
      challenges: ['on_diet', 'into_darkness'],
    })
  })

  it('serializes and round-trips melee and thrown weapon kinds', () => {
    const state: QueryState = {
      ...defaultQueryState(),
      requirements: [
        row({ kind: 'melee_weapon', tier: { mode: 'exact', value: 5 } }),
        row({ key: 2, kind: 'thrown_weapon' }),
        row({ key: 3, kind: 'thrown_weapon', item: 'shuriken' }),
      ],
    }
    expect(JSON.parse(toQueryJson(state))).toEqual({
      auto_apply_trinket: true,
      requirements: [
        { kind: 'melee_weapon', tier: { exact: 5 } },
        { kind: 'thrown_weapon' },
        { kind: 'thrown_weapon', item: 'shuriken' },
      ],
    })
    expect(fromQueryJson(toQueryJson(state))).toEqual(state)
    // Documents with a plain weapon kind keep decoding unchanged.
    expect(
      fromQueryJson('{"requirements":[{"kind":"weapon"}]}').requirements[0]
        ?.kind
    ).toBe('weapon')
  })

  it('always writes a requirement category, deriving it from the item', () => {
    // The engine's start decision compares categories for equality, so both
    // directions of the mapping fill the kind in from the named item.
    const state: QueryState = {
      ...defaultQueryState(),
      requirements: [row({ item: 'sword' })],
    }
    expect(toQueryJson(state)).toBe(
      '{"requirements":[{"kind":"weapon","item":"sword"}],"auto_apply_trinket":true}'
    )
    expect(
      fromQueryJson(
        '{"requirements":[{"item":"sword"},{"item":"ring_haste"},{"kind":"wand"}]}'
      ).requirements.map((requirement) => requirement.kind)
    ).toEqual(['weapon', 'ring', 'wand'])
    // An unknown item names no category, and the document stays kind-less.
    expect(
      fromQueryJson('{"requirements":[{"item":"no_such_item"}]}')
        .requirements[0]?.kind
    ).toBeUndefined()
  })

  it('carries the Wandmaker quest and defaults it to any', () => {
    const base: QueryState = {
      ...defaultQueryState(),
      requirements: [row({ kind: 'wand' })],
    }
    expect(toQueryJson(base)).toBe(
      '{"requirements":[{"kind":"wand"}],"auto_apply_trinket":true}'
    )
    expect(fromQueryJson(toQueryJson(base)).wandmakerQuest).toBeUndefined()
    for (const variant of [
      'corpse_dust',
      'elemental_embers',
      'rotberry',
    ] as const) {
      const state: QueryState = { ...base, wandmakerQuest: variant }
      expect(JSON.parse(toQueryJson(state))).toEqual({
        auto_apply_trinket: true,
        requirements: [{ kind: 'wand' }],
        wandmaker_quest: variant,
      })
      expect(fromQueryJson(toQueryJson(state))).toEqual(state)
    }
    // An unknown quest fails the import rather than silently widening it.
    expect(() =>
      fromQueryJson(
        '{"requirements":[{"kind":"wand"}],"wandmaker_quest":"dust"}'
      )
    ).toThrow(/Wandmaker quest/)
  })

  it('round-trips a fully loaded state', () => {
    const state: QueryState = {
      autoApplyTrinket: false,
      requirements: [
        row({
          kind: 'weapon',
          item: undefined,
          tier: { mode: 'at_most', value: 4 },
          upgrade: { mode: 'exact', value: 3 },
          effect: 'Blazing',
          source: 'locked_chest',
          identityGroup: 2,
          maxDepth: 8,
        }),
      ],
      maxDepth: 19,
      requireBlacksmith: true,
      excludeBlacksmithRewards: true,
      challenges: ['faith_is_my_armor', 'hostile_champions'],
    }
    expect(fromQueryJson(toQueryJson(state))).toEqual(state)
  })

  it('loads a query saved with the retired fast-mode flag and drops it', () => {
    const legacy =
      '{"requirements":[{"kind":"wand"}],"max_depth":12,"fast_mode":true}'
    const current = '{"requirements":[{"kind":"wand"}],"max_depth":12}'
    expect(fromQueryJson(legacy)).toEqual(fromQueryJson(current))
    // And nothing writes the key back out.
    expect(toQueryJson(fromQueryJson(legacy))).toBe(current)
  })

  it('snaps stored empty boss-floor limits to the equivalent floor below', () => {
    const state = fromQueryJson(
      '{"requirements":[{"kind":"wand","max_depth":5},{"kind":"ring","max_depth":10}],"max_depth":15}'
    )
    expect(state.maxDepth).toBe(14)
    expect(
      state.requirements.map((requirement) => requirement.maxDepth)
    ).toEqual([4, 9])
  })

  it('offers every floor except the empty boss floors as a limit', () => {
    expect(FLOOR_LIMIT_OPTIONS).toHaveLength(21)
    for (const boss of [5, 10, 15])
      expect(FLOOR_LIMIT_OPTIONS).not.toContain(boss)
    expect(FLOOR_LIMIT_OPTIONS).toContain(20)
    expect(FLOOR_LIMIT_OPTIONS).toContain(24)
    expect([4, 5, 9, 10, 14, 15, 20, 24].map(normalizeFloorLimit)).toEqual([
      4, 4, 9, 9, 14, 14, 20, 24,
    ])
  })

  it('maps slider values to indices, snapping off-list values to the nearest option below', () => {
    FLOOR_LIMIT_OPTIONS.forEach((floor, index) => {
      expect(nearestOptionIndex(FLOOR_LIMIT_OPTIONS, floor)).toBe(index)
    })
    // Empty boss floors land on the slot of the equivalent floor below.
    for (const [boss, below] of [
      [5, 4],
      [10, 9],
      [15, 14],
    ] as const)
      expect(nearestOptionIndex(FLOOR_LIMIT_OPTIONS, boss)).toBe(
        FLOOR_LIMIT_OPTIONS.indexOf(below)
      )
    // Out-of-range values snap to the nearest option below, never slot 0.
    expect(nearestOptionIndex(FLOOR_LIMIT_OPTIONS, 30)).toBe(
      FLOOR_LIMIT_OPTIONS.length - 1
    )
    expect(nearestOptionIndex(FLOOR_LIMIT_OPTIONS, 0)).toBe(0)
  })
})
