import { describe, expect, it } from 'bun:test'
import type { QueryState, RequirementState } from '../../../src/engine/types'
import {
  canonicalEffect,
  defaultQueryState,
  fromQueryJson,
  toQueryDocument,
  toQueryJson,
} from '../../../src/features/query/query'
import { weaponEnchantments } from '../../../src/shared/game/catalog'

const plain = (patch: Partial<RequirementState>): RequirementState => ({
  key: 1,
  kind: 'weapon',
  tier: { mode: 'any', value: 3 },
  upgrade: { mode: 'any', value: 1 },
  uncursed: false,
  ...patch,
})

describe('query serialization of effects, groups and keys', () => {
  it('writes effect sets as a bare name, a catalog-ordered list, or the any_enchantment shorthand', () => {
    const doc = (effect: RequirementState['effect']) =>
      toQueryDocument({
        ...defaultQueryState(),
        requirements: [plain({ effect })],
      }).requirements[0]
    expect(doc('Blazing')).toEqual({ kind: 'weapon', effect: 'Blazing' })
    expect(doc(['Blazing'])).toEqual({ kind: 'weapon', effect: 'Blazing' })
    // Out-of-order input is written in catalog order.
    expect(doc(['Vampiric', 'Blocking', 'Projecting'])).toEqual({
      kind: 'weapon',
      effect: ['Blocking', 'Projecting', 'Vampiric'],
    })
    expect(doc([...weaponEnchantments].reverse())).toEqual({
      kind: 'weapon',
      effect: 'any_enchantment',
    })
    expect(doc('any_enchantment')).toEqual({
      kind: 'weapon',
      effect: 'any_enchantment',
    })
    expect(doc([])).toEqual({ kind: 'weapon' })
    expect(canonicalEffect(['Blocking', 'Annoying'], 'melee_weapon')).toEqual([
      'Blocking',
      'Annoying',
    ])
  })

  it('loads an old document with a bare effect name unchanged', () => {
    const state = fromQueryJson(
      '{"requirements":[{"kind":"weapon","effect":"Blazing"}]}'
    )
    expect(state.requirements[0]?.effect).toBe('Blazing')
    expect(toQueryJson(state)).toBe(
      '{"requirements":[{"kind":"weapon","effect":"Blazing"}]}'
    )
  })

  it('round-trips effect lists, any_enchantment and combined levels', () => {
    const state: QueryState = {
      ...defaultQueryState(),
      requirements: [
        plain({
          item: 'greatshield',
          upgrade: { mode: 'exact', value: 2 },
          effect: ['Blocking', 'Projecting', 'Vampiric'],
        }),
        plain({
          key: 2,
          kind: 'armor',
          effect: 'any_enchantment',
          uncursed: true,
        }),
        plain({
          key: 3,
          kind: 'ring',
          item: 'ring_might',
          levelSum: { group: 1, atLeast: 4 },
        }),
        plain({
          key: 4,
          kind: 'ring',
          item: 'ring_might',
          levelSum: { group: 1, atLeast: 4 },
        }),
      ],
    }
    const sum = { group: 1, at_least: 4 }
    expect(JSON.parse(toQueryJson(state))).toEqual({
      auto_apply_trinket: true,
      requirements: [
        {
          kind: 'weapon',
          item: 'greatshield',
          upgrade: 2,
          effect: ['Blocking', 'Projecting', 'Vampiric'],
        },
        { kind: 'armor', effect: 'any_enchantment', uncursed: true },
        { kind: 'ring', item: 'ring_might', level_sum: sum },
        { kind: 'ring', item: 'ring_might', level_sum: sum },
      ],
    })
    // The unreleased upgrade_sum key is refused, not reinterpreted.
    expect(() =>
      fromQueryJson(
        '{"requirements":[{"kind":"ring","upgrade_sum":{"group":1,"at_least":2}}]}'
      )
    ).toThrow(/upgrade_sum/)
    expect(fromQueryJson(toQueryJson(state))).toEqual(state)
    // A single-name list decodes to the bare name, so a round trip is the identity.
    expect(
      fromQueryJson('{"requirements":[{"kind":"weapon","effect":["Blazing"]}]}')
        .requirements[0]?.effect
    ).toBe('Blazing')
    expect(() =>
      fromQueryJson('{"requirements":[{"kind":"weapon","effect":7}]}')
    ).toThrow(/effect/)
  })

  it('writes alternative groups as one any_of entry and reads them back with fresh group ids', () => {
    const state: QueryState = {
      ...defaultQueryState(),
      requirements: [
        plain({
          item: 'spear',
          upgrade: { mode: 'exact', value: 3 },
          alternativeGroup: 7,
        }),
        plain({ kind: 'wand' }),
        plain({
          kind: 'thrown_weapon',
          item: 'shuriken',
          upgrade: { mode: 'exact', value: 2 },
          alternativeGroup: 7,
        }),
        plain({ item: 'sword', alternativeGroup: 2 }),
        plain({ item: 'mace', alternativeGroup: 2 }),
        // A group of one is a plain requirement.
        plain({ item: 'dagger', alternativeGroup: 9 }),
      ],
    }
    expect(JSON.parse(toQueryJson(state))).toEqual({
      auto_apply_trinket: true,
      requirements: [
        {
          any_of: [
            { kind: 'weapon', item: 'spear', upgrade: 3 },
            { kind: 'thrown_weapon', item: 'shuriken', upgrade: 2 },
          ],
        },
        { kind: 'wand' },
        {
          any_of: [
            { kind: 'weapon', item: 'sword' },
            { kind: 'weapon', item: 'mace' },
          ],
        },
        { kind: 'weapon', item: 'dagger' },
      ],
    })
    const reread = fromQueryJson(toQueryJson(state))
    // Members regroup at the first member's position, numbered 1, 2, … in order.
    expect(
      reread.requirements.map((requirement) => [
        requirement.item,
        requirement.alternativeGroup,
      ])
    ).toEqual([
      ['spear', 1],
      ['shuriken', 1],
      [undefined, undefined],
      ['sword', 2],
      ['mace', 2],
      ['dagger', undefined],
    ])
    expect(toQueryJson(reread)).toBe(toQueryJson(state))
    expect(() => fromQueryJson('{"requirements":[{"any_of":[]}]}')).toThrow(
      /any_of/
    )
    expect(() =>
      fromQueryJson(
        '{"requirements":[{"any_of":[{"any_of":[{"item":"sword"}]}]}]}'
      )
    ).toThrow(/nest/)
  })

  it('keys a loaded list 1…n for the requirement editor and never writes the keys', () => {
    const json =
      '{"requirements":[{"any_of":[{"kind":"weapon","item":"spear"},{"kind":"weapon","item":"mace"}]},{"kind":"wand"}]}'
    const state = fromQueryJson(json)
    expect(state.requirements.map((requirement) => requirement.key)).toEqual([
      1, 2, 3,
    ])
    expect(toQueryJson(state)).toBe(json)
  })
})
