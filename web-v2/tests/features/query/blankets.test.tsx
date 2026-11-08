import { beforeAll, expect, it } from 'bun:test'
import {
  analyze_query,
  decode_share_text,
  encode_share_link,
  filter_seeds,
  scout,
} from '../../../src/engine/pkg/seedfinder.js'
import type {
  BoardEdit,
  QueryState,
  ScoutResult,
} from '../../../src/engine/types'
import {
  decodeResultsFile,
  encodeResultsFile,
} from '../../../src/features/find/results/results-file'
import {
  fromQueryJson,
  requirementToDocument,
  toQueryDocument,
  toQueryJson,
} from '../../../src/features/query/query'
import {
  editBoard,
  requirementBoardOf,
} from '../../../src/features/query/requirements/board'
import { validateQuery } from '../../../src/features/query/validation'
import { loadEngine } from '../../engine/engine'
import {
  analysisOf,
  findButton,
  renderAdvanced,
  resetAdvancedRender,
} from './advanced-render'
import { drawSheet, sheetOn } from './sheet-render'

beforeAll(loadEngine)
resetAdvancedRender()

const document = {
  max_depth: 9,
  requirements: [
    { item: 'wand_lightning', upgrade: { at_least: 2 } },
    { item: 'wand_disintegration', upgrade: { at_least: 2 } },
    { item: 'wand_frost', upgrade: { at_least: 2 } },
    { kind: 'wand', upgrade: 3, source: 'wandmaker_reward', blanket: true },
  ],
}
const state = () => fromQueryJson(JSON.stringify(document))
const throughShareAndFile = (query: QueryState) => {
  expect(
    fromQueryJson(decode_share_text(encode_share_link(toQueryJson(query))))
  ).toEqual(query)
  expect(
    decodeResultsFile(encodeResultsFile(toQueryDocument(query), [])).query
  ).toEqual(query)
}
const edited = (query: QueryState, edits: BoardEdit[]): QueryState => {
  const answer = editBoard(query, edits)
  if (!answer.ok) throw new Error(answer.error)
  return { ...query, requirements: answer.value.requirements }
}
const blanketSection = (drawn: HTMLElement) =>
  drawn.querySelector('section[aria-label="Blanket Requirements"]')

it('preserves blankets in saved queries, share links, and results files', () => {
  const query = state()
  expect(validateQuery(query).valid).toBe(true)
  expect(fromQueryJson(toQueryJson(query))).toEqual(query)
  throughShareAndFile(query)
  expect(() =>
    fromQueryJson('{"requirements":[{"kind":"wand","blanket":"true"}]}')
  ).toThrow(/boolean/)
})

it('shows a collapsed blanket board with a count, and the sheet source and upgrade controls', () => {
  const query = state()
  const drawn = renderAdvanced(query)
  const blankets = blanketSection(drawn)
  const collapsible = blankets?.querySelector('[data-slot="collapsible"]')
  expect(collapsible?.getAttribute('data-state')).toBe('closed')
  expect(
    collapsible?.querySelector('[data-slot="collapsible-trigger"]')?.textContent
  ).toBe('Blanket Requirements1')
  expect(
    blankets?.querySelector('[aria-label="About blanket requirements"]')
  ).not.toBeNull()
  const editor = drawSheet(sheetOn(query, { type: 'row', key: 4 }))
  expect(editor.title).toBe('Edit Blanket Requirement')
  expect(editor.body.querySelector('[aria-label="Source"]')?.textContent).toBe(
    'Wandmaker reward'
  )
  expect(editor.body.textContent).toContain('Upgrade')
  expect(editor.body.textContent).not.toContain('Total item count')
  // A new blanket starts on the kind of the first ordinary requirement.
  const added = drawSheet(sheetOn(query, { type: 'new', blanket: true }))
  expect(added.title).toBe('New Blanket Requirement')
  expect(added.subject).toBe('Any wand')
  expect(added.body.textContent).not.toContain('Total item count')
})

it('keeps identical blanket chips separate from item stacks and OR labels on the other board', () => {
  const query = fromQueryJson(
    '{"requirements":[{"item":"wand_frost"},{"item":"wand_lightning"},{"item":"wand_frost","blanket":true},{"item":"wand_frost","blanket":true}]}'
  )
  const answer = requirementBoardOf(query)
  if (!answer.ok) throw new Error(answer.error)
  const board = answer.value
  expect(board.items.map((item) => [item.id, item.blanket])).toEqual([
    ['r1', false],
    ['r2', false],
    ['r3', true],
    ['r4', true],
  ])
  expect(board.counts).toEqual({ ordinary: 2, blanket: 2 })
  expect(board.items[2]?.chips[0]?.stack.can_grow).toBe(false)
  // A chip never joins the other board.
  expect(board.items[0]?.chips[0]?.join).toEqual([2])
  expect(edited(query, [{ type: 'join', source: 1, target: 3 }])).toEqual(query)
  // Either/or labels are allocated across both boards.
  const joined = edited(query, [
    { type: 'join', source: 2, target: 1 },
    { type: 'join', source: 4, target: 3 },
  ])
  const labels = joined.requirements.map(
    (requirement) => requirement.alternativeGroup
  )
  expect(new Set(labels).size).toBe(2)
  expect(validateQuery(joined).valid).toBe(true)
  const blanket = joined.requirements.find(
    (requirement) => requirement.key === 3
  )
  if (!blanket) throw new Error('no blanket 3')
  const saved = edited(joined, [
    {
      type: 'save',
      key: 3,
      requirement: requirementToDocument({
        ...blanket,
        source: 'wandmaker_reward',
      }),
      count: 1,
      total: null,
      copy_depth: null,
    },
  ])
  expect(
    saved.requirements.find((requirement) => requirement.key === 3)
  ).toMatchObject({
    blanket: true,
    source: 'wandmaker_reward',
    alternativeGroup: blanket.alternativeGroup,
  })
})

it('rejects a blanket without ordinary items and mixed ordinary/blanket alternatives', () => {
  const query = state()
  query.requirements = query.requirements.slice(3)
  expect(validateQuery(query).valid).toBe(false)
  expect(JSON.parse(analyze_query(toQueryJson(query))).valid).toBe(false)
  const mixed = fromQueryJson(
    '{"requirements":[{"any_of":[{"kind":"wand"},{"kind":"wand","blanket":true}]}]}'
  )
  expect(validateQuery(mixed).valid).toBe(false)
})

it('estimates narrowing without charging for a fourth wand', () => {
  const query = state()
  const narrowed = analysisOf(query)
  query.requirements.pop()
  const base = analysisOf(query)
  if (!narrowed.valid || !base.valid) throw new Error('invalid query')
  expect(narrowed.impossible).toBe(false)
  expect(narrowed.probability).toBeGreaterThan(0)
  expect(narrowed.probability ?? 1).toBeLessThan(base.probability ?? 0)
})

it('warns and disables Find when a +3 blanket conflicts with exact +2 wands', () => {
  const query = fromQueryJson(
    JSON.stringify({
      requirements: [
        { item: 'wand_lightning', upgrade: 2 },
        { item: 'wand_disintegration', upgrade: 2 },
        { kind: 'wand', upgrade: 3, blanket: true },
      ],
    })
  )
  const analysis = analysisOf(query)
  expect(analysis).toMatchObject({
    valid: true,
    impossible: true,
    probability: null,
  })
  const drawn = renderAdvanced(query, analysis)
  expect(drawn.textContent).toContain('Impossible query')
  expect(findButton(drawn)?.disabled).toBe(true)
})

it('searches and scouts a real Wandmaker reward as one item serving two conditions', () => {
  const seed = 'AAA-AAA-AAA'
  const initial = JSON.parse(scout(JSON.stringify({ seed }))) as ScoutResult
  const reward = initial.items.find(
    (item) => item.source === 'wandmaker_reward'
  )
  if (!reward) throw new Error('no Wandmaker reward')
  const query = {
    requirements: [
      { item: reward.id },
      { kind: 'wand', source: 'wandmaker_reward', blanket: true },
    ],
  }
  const result = JSON.parse(
    scout(JSON.stringify({ seed, query }))
  ) as ScoutResult
  expect(result.matchedRequirements).toBe(2)
  expect(result.items.filter((item) => item.matched)).toHaveLength(1)
  expect(
    JSON.parse(filter_seeds(JSON.stringify(query), new Float64Array([0])))
  ).toHaveLength(1)
})

it('keeps Auto resin on the ordinary board and preserves blankets through shared documents', () => {
  const query = fromQueryJson(
    JSON.stringify({ ...document, arcane_resin: 'auto' })
  )
  expect(validateQuery(query).valid).toBe(true)
  throughShareAndFile(query)
  const drawn = renderAdvanced(query)
  expect(
    drawn.querySelectorAll('[aria-label="Edit Arcane Resin"]')
  ).toHaveLength(1)
  expect(
    drawn
      .querySelector('section[aria-label="Requirements"]')
      ?.querySelector('[aria-label="Edit Arcane Resin"]')
  ).not.toBeNull()
  expect(
    blanketSection(drawn)?.querySelector('[aria-label="Edit Arcane Resin"]')
  ).toBeNull()
})

it('analyzes Auto blanket witnesses quickly and scouts the same reserved wand', () => {
  const query = {
    arcane_resin: 'auto',
    requirements: [
      { item: 'wand_lightning', upgrade: 2 },
      { kind: 'wand', upgrade: 2, blanket: true },
    ],
  }
  const started = performance.now()
  const analysis = JSON.parse(analyze_query(JSON.stringify(query)))
  expect(performance.now() - started).toBeLessThan(1000)
  expect(analysis).toMatchObject({ valid: true, impossible: false })
  const direct = JSON.parse(
    analyze_query(
      JSON.stringify({ ...query, requirements: query.requirements.slice(0, 1) })
    )
  )
  expect(analysis.probability).toBeCloseTo(direct.probability, 12)
  const wider = {
    arcane_resin: 'auto',
    auto_apply_trinket: true,
    requirements: [
      ...Array.from({ length: 4 }, () => ({ kind: 'wand' })),
      {
        kind: 'wand',
        upgrade: { at_least: 1 },
        uncursed: true,
        blanket: true,
      },
    ],
  }
  const wideStarted = performance.now()
  const wideAnalysis = JSON.parse(analyze_query(JSON.stringify(wider)))
  expect(performance.now() - wideStarted).toBeLessThan(1000)
  expect(wideAnalysis).toMatchObject({ valid: true, impossible: false })
  expect(wideAnalysis.probability).toBeGreaterThan(0)
  const result = JSON.parse(
    scout(JSON.stringify({ seed: 'AAA-AAA-AAS', query }))
  ) as ScoutResult
  expect(result.matchedRequirements).toBe(3)
  expect(result.totalRequirements).toBe(3)
  expect(
    JSON.parse(filter_seeds(JSON.stringify(query), new Float64Array([18])))
  ).toHaveLength(1)
})
