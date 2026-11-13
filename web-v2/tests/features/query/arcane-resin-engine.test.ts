import { beforeAll, describe, expect, it } from 'bun:test'
import {
  analyze_query,
  filter_seeds,
  SearchSession,
} from '../../../src/engine/pkg/seedfinder.js'
import type { SearchAdvance } from '../../../src/engine/types'
import { fromQueryJson } from '../../../src/features/query/query'
import { validateQuery } from '../../../src/features/query/validation'
import { loadEngine, reportItems, reportOf } from '../../engine/engine'

beforeAll(loadEngine)

const document = {
  arcane_resin: 3,
  requirements: [{ item: 'wand_lightning', upgrade: 2 }],
}
const analyze = (query: unknown) =>
  JSON.parse(analyze_query(JSON.stringify(query)))

describe('Arcane Resin in the engine', () => {
  it('credits the starting wand once and keeps excluded wands reserved', () => {
    const credit = {
      max_depth: 1,
      arcane_resin: 2,
      arcane_resin_filter: { include_mage_wand: true, source: 'ghost_reward' },
      requirements: [],
    }
    const result = reportOf({ seed: 'AAA-AAA-AAA', query: credit })
    expect(result.query?.matchedRequirements).toBe(1)
    expect(reportItems(result).filter((item) => item.matched)).toHaveLength(0)
    expect(analyze(credit).probability).toBe(1)
    for (const invalid of [null, 1, 'true']) {
      const json = JSON.stringify({
        ...credit,
        arcane_resin_filter: { include_mage_wand: invalid },
      })
      expect(() => fromQueryJson(json)).toThrow()
      expect(JSON.parse(analyze_query(json)).valid).toBe(false)
      const exclusion = JSON.stringify({
        requirements: [{ kind: 'wand', exclude_resin: invalid }],
      })
      expect(() => fromQueryJson(exclusion)).toThrow()
      expect(JSON.parse(analyze_query(exclusion)).valid).toBe(false)
    }
    for (const requirement of [
      { kind: 'ring', exclude_resin: true },
      { kind: 'wand', blanket: true, exclude_resin: true },
    ]) {
      const json = JSON.stringify({
        requirements: [{ kind: 'wand' }, requirement],
      })
      expect(validateQuery(fromQueryJson(json)).valid).toBe(false)
      expect(JSON.parse(analyze_query(json)).valid).toBe(false)
    }
  })

  it('searches, reports and refines fixed and Auto resin through the real engine', () => {
    // This seed's required +2 Lightning needs 3 resin, matching the fixed query.
    for (const query of [document, { ...document, arcane_resin: 'auto' }]) {
      const json = JSON.stringify(query)
      const session = new SearchSession(json, 18, 19)
      try {
        const found = JSON.parse(session.advance(1)) as SearchAdvance
        expect(found.matches.map((match) => match.code)).toEqual([
          'AAA-AAA-AAS',
        ])
        expect(JSON.parse(filter_seeds(json, new Float64Array([18])))).toEqual(
          found.matches
        )
        const report = reportOf({ seed: 'AAA-AAA-AAS', query })
        expect(report.query).toEqual({
          matchedRequirements: 2,
          totalRequirements: 2,
        })
        const marked = reportItems(report).filter((item) => item.matched)
        const reserved = marked.find(
          (item) => item.id === 'wand_lightning' && item.upgrade === 2
        )
        expect(reserved).toBeDefined()
        expect(
          marked
            .filter((item) => item !== reserved)
            .every((item) => item.category === 'wand' && !item.cursed)
        ).toBe(true)
      } finally {
        session.free()
      }
    }
    const harder = JSON.stringify({ ...document, arcane_resin: 100 })
    expect(JSON.parse(filter_seeds(harder, new Float64Array([18])))).toEqual([])
  })
})
