import { beforeAll, expect, it } from 'bun:test'
import {
  analyze_query,
  SearchSession,
} from '../../../src/engine/pkg/seedfinder.js'
import { fromQueryJson, toQueryJson } from '../../../src/features/query/query'
import {
  changeSheet,
  type SheetTarget,
} from '../../../src/features/query/requirements/sheet'
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

const trinkets = [
  'parchment_scrap',
  'thirteen_leaf_clover',
  'rat_skull',
  'vial_of_blood',
  'petrified_seed',
  'wondrous_resin',
  'mimic_tooth',
]

for (const limit of [0, 1, 2])
  it(`blocks oversubscribed offers and shared transmute limit ${limit}`, () => {
    const requirements: { item: string; trinket_transmutations: number }[] =
      trinkets.slice(0, 5 + limit).map((item, index) => ({
        item,
        trinket_transmutations: index < 4 ? 0 : limit,
      }))
    if (limit === 0)
      requirements.push({ item: 'wondrous_resin', trinket_transmutations: 3 })
    const query = fromQueryJson(JSON.stringify({ requirements }))
    const analysis = analysisOf(query)
    expect(analysis).toMatchObject({
      valid: true,
      impossible: true,
      probability: null,
    })
    if (!analysis.valid) throw new Error(analysis.error)
    expect(analysis.notes).toEqual([
      limit === 0
        ? 'Requires 5 initial trinket offers, but each seed offers only 4.'
        : `${5 + limit} trinket requirements allow at most ${limit} transmutation${limit === 1 ? '' : 's'}; only ${4 + limit} distinct trinkets are reachable.`,
    ])
    const drawn = renderAdvanced(query, analysis)
    const alert = [...drawn.querySelectorAll('[role="alert"]')].find(
      (element) => element.textContent?.includes('Impossible query')
    )
    expect(alert?.textContent).toContain(analysis.notes[0] ?? '')
    expect(drawn.textContent).not.toContain('Quest-reward-only')
    expect(drawn.textContent).not.toContain('floor limit')
    expect(findButton(drawn)?.disabled).toBe(true)
    const session = new SearchSession(toQueryJson(query), 0, 16)
    try {
      expect(JSON.parse(session.advance(16))).toMatchObject({
        state: 'completed',
        tested: 0,
        matches: [],
      })
    } finally {
      session.free()
    }
  })

it("uses the engine's floor-specific reason for a floor failure", () => {
  const analysis = JSON.parse(
    analyze_query(
      '{"max_depth":6,"requirements":[{"item":"wand_lightning","upgrade":3}]}'
    )
  )
  expect(analysis.notes).toEqual([
    'Requirement 1 (Wand of lightning) needs floor 7 or later, beyond its floor limit.',
  ])
})

it('blocks duplicate trinkets in saved queries and the sheet, while allowing blanket reuse', () => {
  const query = fromQueryJson(
    '{"requirements":[{"item":"rat_skull"},{"item":"rat_skull","trinket_transmutations":13}]}'
  )
  expect(analysisOf(query)).toMatchObject({
    impossible: true,
    notes: [
      'Rat Skull is required more than once, but each trinket appears only once in the deck.',
    ],
  })
  const sheetText = (target: SheetTarget, item?: string) => {
    let sheet = sheetOn(query, target)
    if (item) {
      for (const change of [
        { type: 'set_category', value: 'trinket' },
        { type: 'set_item', value: item },
      ] as const) {
        const answer = changeSheet(sheet, change)
        if (!answer.ok) throw new Error(answer.error)
        sheet = answer.value
      }
    }
    return drawSheet(sheet).body.textContent ?? ''
  }
  for (const blanket of [false, true])
    expect(
      sheetText({ type: 'new', blanket }, 'rat_skull').includes(
        'This trinket is already required.'
      )
    ).toBe(!blanket)
  // A chip's sheet counts the other rows naming its trinket, never itself.
  expect(sheetText({ type: 'row', key: 1 })).toContain(
    'This trinket is already required.'
  )
  const single = fromQueryJson('{"requirements":[{"item":"rat_skull"}]}')
  expect(sheetOn(single, { type: 'row', key: 1 }).form.errors).toEqual([])
})
