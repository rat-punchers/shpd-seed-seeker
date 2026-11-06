import { beforeAll, describe, expect, it } from 'bun:test'
import { $userPresets } from '../../../src/app/store/presets'
import { CONFIG } from '../../../src/config'
import {
  analyze_query,
  decode_share_text,
  encode_share_link,
} from '../../../src/engine/pkg/seedfinder.js'
import {
  decodeResultsFile,
  encodeResultsFile,
} from '../../../src/features/find/results/results-file'
import {
  defaultQueryState,
  fromQueryJson,
  toQueryDocument,
  toQueryJson,
} from '../../../src/features/query/query'
import { validateQuery } from '../../../src/features/query/validation'
import { probabilityLabel } from '../../../src/shared/format'
import { loadEngine } from '../../engine/engine'
import {
  analysisOf,
  findButton,
  renderAdvanced,
  resetAdvancedRender,
} from './advanced-render'

beforeAll(loadEngine)
resetAdvancedRender()

const document = {
  arcane_resin: 3,
  requirements: [{ item: 'wand_lightning', upgrade: 2 }],
}
const analyze = (query: unknown) =>
  JSON.parse(analyze_query(JSON.stringify(query)))
const viaShareLink = (json: string) =>
  fromQueryJson(decode_share_text(encode_share_link(json)))

describe('Arcane Resin', () => {
  it('reserves stack copies for reforging without budgeting resin for them', () => {
    for (const linked of [false, true]) {
      for (const excluded of [false, true]) {
        const identity = linked
          ? { kind: 'wand', identity_group: 1 }
          : { item: 'wand_frost' }
        const requirements = [
          {
            ...identity,
            ...(excluded ? { exclude_resin: true } : { upgrade: 3 }),
          },
          { ...identity },
          { ...identity },
        ]
        const state = fromQueryJson(
          JSON.stringify({
            requirements,
            arcane_resin: 'auto',
            arcane_resin_filter: { source: 'ghost_reward' },
          })
        )
        expect(validateQuery(state).valid).toBe(true)
        expect(viaShareLink(toQueryJson(state))).toEqual(state)
        const baseline = analyze({ requirements })
        const auto = JSON.parse(analyze_query(toQueryJson(state)))
        expect(baseline.probability).toBeGreaterThan(0)
        expect(auto.probability).toBeCloseTo(baseline.probability, 12)
      }
    }
  })

  it('analyzes wider Auto wand queries quickly, including AutoTrinket', () => {
    for (const count of [4, 8]) {
      const started = performance.now()
      const analysis = analyze({
        arcane_resin: 'auto',
        auto_apply_trinket: true,
        requirements: Array.from({ length: count }, () => ({ kind: 'wand' })),
      })
      const elapsed = performance.now() - started
      expect(analysis).toMatchObject({ valid: true, impossible: false })
      expect(analysis.probability).toBeGreaterThanOrEqual(0)
      expect(analysis.probability).toBeLessThanOrEqual(1)
      // Allows CI contention while catching multi-second stalls.
      expect(elapsed).toBeLessThan(1000)
      if (count === 4) expect(analysis.probability).toBeGreaterThan(0.1)
    }
  })

  it('preserves the minimum in query state, presets, share links and results files', () => {
    for (const arcane_resin of [3, 'auto'] as const) {
      for (const [requirements, arcane_resin_filter] of [
        [[], undefined],
        [document.requirements, undefined],
        [[], { uncursed: false, max_depth: 4, source: 'chest' }],
        [document.requirements, { max_depth: 9 }],
        [
          [{ item: 'wand_lightning', exclude_resin: true }],
          { include_mage_wand: true },
        ],
        [
          [
            {
              any_of: [
                { item: 'wand_frost', exclude_resin: true },
                { item: 'wand_lightning' },
              ],
            },
          ],
          {
            uncursed: false,
            source: 'wandmaker_reward',
            include_mage_wand: true,
          },
        ],
      ] as const) {
        const state = fromQueryJson(
          JSON.stringify({
            ...document,
            arcane_resin,
            requirements,
            arcane_resin_filter,
          })
        )
        expect(validateQuery(state).valid).toBe(true)
        expect(fromQueryJson(toQueryJson(state))).toEqual(state)
        expect(viaShareLink(toQueryJson(state))).toEqual(state)
        $userPresets.set([{ name: 'Resin', query: state }])
        const stored = JSON.parse(
          localStorage.getItem(CONFIG.storageKeys.presets) ?? '[]'
        ) as { query: unknown }[]
        expect(fromQueryJson(JSON.stringify(stored[0]?.query))).toEqual(state)
        const exported = encodeResultsFile(toQueryDocument(state), [
          'AAA-AAA-AAS',
        ])
        expect(decodeResultsFile(exported).query).toEqual(state)
      }
    }
    $userPresets.set([])
    expect(fromQueryJson('{"requirements":[]}').arcaneResin).toBeUndefined()
    expect(
      toQueryDocument({ ...defaultQueryState(), arcaneResin: 0 }).arcane_resin
    ).toBeUndefined()
  })

  it('rejects malformed amounts and filters, and allows resin-only searches', () => {
    for (const value of [
      -1,
      1.5,
      65536,
      '6',
      'Auto',
      'automatic',
      {},
      true,
      null,
    ]) {
      const json = JSON.stringify({ ...document, arcane_resin: value })
      expect(() => fromQueryJson(json)).toThrow(/Arcane Resin/)
      expect(JSON.parse(analyze_query(json)).valid).toBe(false)
    }
    for (const arcaneResin of [NaN, Infinity, -1, 0.5, 65536, 0])
      expect(validateQuery({ ...defaultQueryState(), arcaneResin }).valid).toBe(
        false
      )
    for (const arcane_resin_filter of [
      null,
      { uncursed: 'yes' },
      { max_depth: 0 },
      { max_depth: 25 },
      { source: 'unknown' },
    ]) {
      const json = JSON.stringify({ ...document, arcane_resin_filter })
      expect(() => fromQueryJson(json)).toThrow(/Arcane Resin/)
      expect(JSON.parse(analyze_query(json)).valid).toBe(false)
    }
    const json = JSON.stringify({ requirements: [], arcane_resin: 6 })
    expect(validateQuery(fromQueryJson(json)).valid).toBe(true)
    expect(JSON.parse(analyze_query(json))).toMatchObject({
      valid: true,
      impossible: false,
      probability: expect.any(Number),
    })
  })

  it('shows the probability for resin-only and mixed queries in Advanced', () => {
    for (const requirements of [[], document.requirements]) {
      const state = fromQueryJson(JSON.stringify({ ...document, requirements }))
      const analysis = analysisOf(state)
      expect(analysis).toMatchObject({ valid: true, impossible: false })
      if (!analysis.valid) throw new Error(analysis.error)
      expect(analysis.probability).toBeGreaterThan(0)
      const drawn = renderAdvanced(state, analysis)
      expect(
        drawn.querySelector('[data-testid="query-estimate"]')?.textContent
      ).toBe(probabilityLabel(analysis.probability))
      expect(findButton(drawn)?.disabled).toBe(false)
    }
    const baseline = analyze({ ...document, arcane_resin: 0 }).probability
    const constrained = analyze({ ...document, arcane_resin: 12 }).probability
    expect(constrained).toBeLessThan(baseline)
  })

  it('shows a resin requirement chip, removed through its menu', () => {
    const drawn = renderAdvanced(
      fromQueryJson('{"arcane_resin":6,"requirements":[]}')
    )
    expect(drawn.textContent).toContain('Arcane Resin')
    expect(
      drawn.querySelector('[aria-label="Edit Arcane Resin"]')
    ).not.toBeNull()
    expect(drawn.querySelector('[aria-label="Remove Arcane Resin"]')).toBeNull()
    expect(drawn.textContent).toContain('≥6')
    expect(
      drawn.querySelector('[data-testid="requirement-count"]')?.textContent
    ).toBe('1 requirement')
  })

  it('keeps numeric zero estimates distinct from unavailable probabilities', () => {
    const analysis = analyze({
      ...document,
      arcane_resin: 65535,
      auto_apply_trinket: true,
    })
    expect(analysis).toMatchObject({ valid: true, probability: 0 })
    expect(probabilityLabel(analysis.probability)).toBe('Match probability ≈ 0')
    expect(probabilityLabel(null)).toBe('Probability unavailable')
  })
})
