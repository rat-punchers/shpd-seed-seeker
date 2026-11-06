import { beforeAll, describe, expect, it } from 'bun:test'
import {
  analyze_query,
  filter_seeds,
  scout,
  seed_report,
} from '../../../src/engine/pkg/seedfinder.js'
import type {
  BoardEdit,
  QueryDocument,
  QueryState,
  ScoutResult,
  SeedReport,
} from '../../../src/engine/types'
import type { ReportItem } from '../../../src/engine/types/report'
import {
  fromQueryJson,
  toQueryDocument,
} from '../../../src/features/query/query'
import {
  editBoard,
  requirementBoardOf,
} from '../../../src/features/query/requirements/board'
import { saveSheet } from '../../../src/features/query/requirements/sheet'
import {
  displayedUpgrade,
  itemsByCategory,
} from '../../../src/shared/game/catalog'
import { loadEngine } from '../../engine/engine'
import { drawSheet, sheetOn } from './sheet-render'

beforeAll(loadEngine)

const boardOf = (query: QueryState) => {
  const answer = requirementBoardOf(query)
  if (!answer.ok) throw new Error(answer.error)
  return answer.value
}
const edited = (query: QueryState, edits: BoardEdit[]): QueryState => {
  const answer = editBoard(query, edits)
  if (!answer.ok) throw new Error(answer.error)
  return { ...query, requirements: answer.value.requirements }
}
const report = (query?: unknown): SeedReport =>
  JSON.parse(
    seed_report(
      JSON.stringify({
        seed: 'AAA-AAA-AAA',
        ...(query ? { query: query as QueryDocument } : {}),
      })
    )
  ) as SeedReport
const reportItems = (seedReport: SeedReport): ReportItem[] =>
  seedReport.floors.flatMap((floor) => floor.items)

/**
 * The artifacts a run can still take: every generated artifact but the
 * alternatives of a reward choice the query's match took.
 */
function availableArtifacts(items: readonly ReportItem[]): Set<string> {
  const taken = new Map<number, number>()
  for (const item of items)
    if (item.matched && item.accessibility.type === 'choice')
      taken.set(item.accessibility.group, item.accessibility.option)
  return new Set(
    items
      .filter((item) => {
        if (item.category !== 'artifact') return false
        const access = item.accessibility
        return !(
          !item.matched &&
          access.type === 'choice' &&
          taken.has(access.group) &&
          taken.get(access.group) !== access.option
        )
      })
      .map((item) => item.id)
  )
}

describe('artifacts in search and Analyze', () => {
  it('leaves fixed artifacts out when matched requirements take their choice group', () => {
    const natural = [
      'unstable_spellbook',
      'sandals_of_nature',
      'alchemists_toolkit',
      'skeleton_key',
    ]
    expect(availableArtifacts(reportItems(report()))).toEqual(new Set(natural))
    const result = report({
      auto_apply_trinket: false,
      requirements: [
        { item: 'ring_haste', source: 'imp_reward' },
        { item: 'wand_prismatic_light', source: 'crystal_chest' },
      ],
    })
    expect(result.query?.matchedRequirements).toBe(2)
    expect(availableArtifacts(reportItems(result))).toEqual(
      new Set(['unstable_spellbook', 'skeleton_key'])
    )
    const own = report({
      auto_apply_trinket: false,
      requirements: [{ item: 'sandals_of_nature', source: 'imp_reward' }],
    })
    expect(own.query?.matchedRequirements).toBe(1)
    expect(availableArtifacts(reportItems(own))).toEqual(new Set(natural))
  })

  it('preserves artifact limits and marks the remaining deck', () => {
    const document = {
      requirements: [{ item: 'ethereal_chains', artifact_transmutations: 4 }],
      max_depth: 19,
    }
    const state = fromQueryJson(JSON.stringify(document))
    expect(state.requirements[0]?.artifactTransmutations).toBe(4)
    expect(toQueryDocument(state).requirements).toMatchObject(
      document.requirements
    )
    const result = report(document)
    expect(result.query?.matchedRequirements).toBe(1)
    const decks = result.trinkets.artifactDecks
    expect(decks.find((deck) => deck.depth === 19)?.order[3]).toMatchObject({
      id: 'ethereal_chains',
      matched: true,
    })
    expect(decks.find((deck) => deck.depth === 0)?.order).toHaveLength(11)
    expect(reportItems(result).filter((item) => item.matched)).toHaveLength(1)
    const { body } = drawSheet(sheetOn(state, { type: 'row', key: 1 }))
    expect(body.textContent).toContain('Allow transmutations')
    expect(body.textContent).toContain('At most 4')
    for (const count of [-1, 11, 1.5, '1'])
      expect(() =>
        fromQueryJson(
          JSON.stringify({
            requirements: [
              { item: 'ethereal_chains', artifact_transmutations: count },
            ],
          })
        )
      ).toThrow()
  })

  it("shows the game's rounded levels for every generated artifact", () => {
    for (const item of itemsByCategory.artifact) {
      const expected =
        item.id === 'sandals_of_nature'
          ? 7
          : ['ethereal_chains', 'timekeepers_hourglass'].includes(item.id)
            ? 6
            : 5
      expect(displayedUpgrade(item.id, 5)).toBe(expected)
      expect(displayedUpgrade(item.id, 0)).toBe(0)
    }
    expect(displayedUpgrade('ring_of_wealth', 3)).toBe(3)
  })

  it('requires a named artifact and exposes floor limits', () => {
    const wildcard = fromQueryJson('{"requirements":[{"kind":"artifact"}]}')
    expect(boardOf(wildcard).items[0]?.problem).not.toBeNull()
    expect(
      JSON.parse(analyze_query('{"requirements":[{"kind":"artifact"}]}')).valid
    ).toBe(false)
    expect(itemsByCategory.artifact).toHaveLength(11)
    const query = fromQueryJson(
      '{"requirements":[{"item":"sandals_of_nature","upgrade":5,"max_depth":19}]}'
    )
    const sheet = sheetOn(query, { type: 'row', key: 1 })
    const { body } = drawSheet(sheet)
    expect(body.textContent).not.toContain('Any artifact')
    expect(body.textContent).not.toContain('Total item count')
    expect(body.textContent).not.toContain('Upgrade level')
    expect(body.textContent).toContain('Limit this item')
    expect(body.querySelector('[aria-valuetext="19"]')).not.toBeNull()
    const saved = saveSheet(query, sheet)
    if (!saved.ok || !('saved' in saved.value))
      throw new Error('the sheet did not save')
    // The sheet offers no upgrade on an artifact but keeps the one a document
    // carried: saved untouched, the query's own list comes back.
    expect(saved.value.saved.changed).toBe(false)
    expect(saved.value.saved.requirements).toBe(query.requirements)
    const repeats = fromQueryJson(
      '{"requirements":[{"item":"ethereal_chains"},{"item":"ethereal_chains","max_depth":14}]}'
    )
    expect(boardOf(repeats).items).toHaveLength(2)
    const alternatives = edited(repeats, [
      { type: 'join', source: 1, target: 2 },
    ])
    expect(boardOf(alternatives).items).toHaveLength(1)
    expect(
      alternatives.requirements.every(
        (requirement) =>
          requirement.item === 'ethereal_chains' &&
          requirement.identityGroup === undefined
      )
    ).toBe(true)
  })

  it('searches artifact OR groups and preserves individual floor limits', () => {
    const state = edited(
      fromQueryJson(
        '{"requirements":[{"item":"unstable_spellbook","max_depth":14},{"item":"ethereal_chains","max_depth":4}]}'
      ),
      [{ type: 'join', source: 2, target: 1 }]
    )
    const document = toQueryDocument(state)
    expect(boardOf(state).items[0]?.chips[0]?.stack.can_grow).toBe(false)
    expect(
      fromQueryJson(JSON.stringify(document))
        .requirements.map((requirement) => requirement.maxDepth ?? 0)
        .sort((a, b) => a - b)
    ).toEqual([4, 14])
    expect(
      JSON.parse(filter_seeds(JSON.stringify(document), new Float64Array([0])))
    ).toHaveLength(1)
    expect(
      JSON.parse(
        filter_seeds(
          '{"requirements":[{"item":"unstable_spellbook","max_depth":13}]}',
          new Float64Array([0])
        )
      )
    ).toHaveLength(0)
  })

  it('reports deterministic artifact records with their choice group', () => {
    const query = {
      requirements: [{ item: 'sandals_of_nature', upgrade: 5, max_depth: 19 }],
    }
    const scouted = JSON.parse(
      scout(JSON.stringify({ seed: 'AAA-AAA-AAA', query }))
    ) as ScoutResult
    expect(scouted.matchedRequirements).toBe(1)
    const result = report(query)
    const artifact = reportItems(result).find(
      (entry) => entry.id === 'sandals_of_nature'
    )
    expect(artifact).toMatchObject({
      category: 'artifact',
      upgrade: 5,
      depth: 19,
      source: 'imp_reward',
      matched: true,
      cursed: false,
    })
    expect(artifact?.accessibility.type).toBe('choice')
    expect(displayedUpgrade('sandals_of_nature', artifact?.upgrade ?? 0)).toBe(
      7
    )
    for (const entry of reportItems(result).filter(
      (item) => item.category === 'artifact'
    ))
      expect(
        itemsByCategory.artifact.find((item) => item.id === entry.id)
      ).toMatchObject({ name: entry.name, sprite: entry.spriteIndex })
    const analysis = JSON.parse(analyze_query(JSON.stringify(query)))
    expect(analysis).toMatchObject({ valid: true, impossible: false })
    expect(analysis.probability).toBeGreaterThan(0)
    expect(analysis.probability).toBeLessThan(1)
  })
})
