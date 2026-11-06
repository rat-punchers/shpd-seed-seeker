import { beforeAll, describe, expect, it } from 'bun:test'
import {
  decode_share_text,
  encode_share_link,
} from '../../../src/engine/pkg/seedfinder.js'
import type { QueryState } from '../../../src/engine/types'
import { linkHere } from '../../../src/features/advanced/copy'
import {
  defaultQueryState,
  toQueryJson,
} from '../../../src/features/query/query'
import {
  hasShareCode,
  withoutFragment,
} from '../../../src/features/query/share-link'
import { loadEngine } from '../../engine/engine'

describe('share link fragments', () => {
  it('detects share codes in fragments', () => {
    expect(hasShareCode('#q=QAMtCYAA')).toBe(true)
    expect(hasShareCode('#other&q=QAMtCYAA')).toBe(true)
    expect(hasShareCode('')).toBe(false)
    expect(hasShareCode('#')).toBe(false)
    expect(hasShareCode('#squire')).toBe(false)
    expect(hasShareCode('#faq=1')).toBe(false)
  })

  it('strips the fragment from an href', () => {
    expect(withoutFragment('https://x.app/#q=QAMtCYAA')).toBe('https://x.app/')
    expect(withoutFragment('https://x.app/')).toBe('https://x.app/')
  })

  it("points the engine's link at this app, keeping its code", () => {
    expect(
      linkHere(
        'https://shpd-seed-seeker.pages.dev/#q=QAMtCYAA',
        'https://seedseeker.nerdcoder.xyz'
      )
    ).toBe('https://seedseeker.nerdcoder.xyz/#q=QAMtCYAA')
    expect(linkHere('QAMtCYAA', 'http://127.0.0.1:46001')).toBe('QAMtCYAA')
  })
})

/**
 * The codec itself is the engine's, so these are conformance tests against
 * the real wasm module.
 */
describe('share link codes', () => {
  beforeAll(loadEngine)

  const query = (...patch: Partial<QueryState>[]): QueryState =>
    Object.assign({ ...defaultQueryState() }, ...patch)
  const base = {
    key: 1,
    tier: { mode: 'any' as const, value: 3 },
    upgrade: { mode: 'any' as const, value: 1 },
    uncursed: false,
  }
  const roundTrip = (state: QueryState) =>
    JSON.parse(decode_share_text(encode_share_link(toQueryJson(state))))

  it('round-trips a query through a shareable link', () => {
    // A +5 needs a tier-4 weapon; the Battle axe is one.
    const state = query({
      requirements: [
        {
          ...base,
          kind: 'weapon',
          item: 'battle_axe',
          upgrade: { mode: 'exact', value: 5 },
        },
      ],
    })
    const link = encode_share_link(toQueryJson(state))
    expect(hasShareCode(new URL(link).hash)).toBe(true)
    // The link this app copies decodes the same.
    const here = linkHere(link, 'http://127.0.0.1:46001')
    expect(JSON.parse(decode_share_text(here))).toEqual(
      JSON.parse(toQueryJson(state))
    )
  })

  it('carries the effects v4.0.0 added', () => {
    const state = query({
      requirements: [
        {
          ...base,
          kind: 'weapon',
          effect: ['Blazing', 'Venomous', 'Eldritch', 'Vorpal', 'Crystal'],
        },
        {
          ...base,
          key: 2,
          kind: 'weapon',
          effect: ['Pressurized', 'Wondrous'],
        },
      ],
    })
    expect(roundTrip(state)).toEqual(JSON.parse(toQueryJson(state)))
  })

  it('carries a vault-treasure source pin', () => {
    const state = query({
      requirements: [{ ...base, kind: 'armor', source: 'vault_treasure' }],
    })
    expect(roundTrip(state)).toEqual(JSON.parse(toQueryJson(state)))
  })
})
