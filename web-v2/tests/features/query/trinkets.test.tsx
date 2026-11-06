import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { QueryState } from '../../../src/engine/types'
import type { ReportTrinkets } from '../../../src/engine/types/report'
import { TrinketChoiceBand } from '../../../src/features/analyze/report/TrinketChoiceBand'
import {
  fromQueryJson,
  toQueryDocument,
} from '../../../src/features/query/query'
import {
  editBoard,
  requirementBoardOf,
} from '../../../src/features/query/requirements/board'
import { saveSheet } from '../../../src/features/query/requirements/sheet'
import { validateQuery } from '../../../src/features/query/validation'
import { itemsByCategory } from '../../../src/shared/game/catalog'
import { drawSheet, sheetOn } from './sheet-render'

const boardOf = (query: QueryState) => {
  const answer = requirementBoardOf(query)
  if (!answer.ok) throw new Error(answer.error)
  return answer.value
}
const row = (query: QueryState, key: number) =>
  drawSheet(sheetOn(query, { type: 'row', key }))

/** The 17 trinkets in catalog order, the first four offered. */
function trinketsWith(
  matched: (index: number) => boolean,
  selected: string | null = null
): ReportTrinkets {
  const order = itemsByCategory.trinket.map((item, index) => ({
    id: item.id,
    name: item.name,
    spriteIndex: item.sprite,
    matched: matched(index),
  }))
  return {
    offers: order.slice(0, 4),
    selected,
    transmutationOrder: order.slice(4),
    artifactDecks: [],
  }
}

function band(trinkets: ReportTrinkets, busy = false): HTMLElement {
  const element = document.createElement('div')
  element.innerHTML = renderToStaticMarkup(
    <TrinketChoiceBand
      trinkets={trinkets}
      choice={{ busy, select: () => {} }}
    />
  )
  return element
}

describe('offered trinkets', () => {
  it('round-trips a transmutation limit and words it on the chip and the sheet', () => {
    const query = fromQueryJson(
      '{"requirements":[{"any_of":[{"item":"rat_skull","trinket_transmutations":13},{"item":"mimic_tooth"}]}]}'
    )
    const [requirement] = query.requirements
    if (!requirement) throw new Error('no requirement')
    expect(requirement.trinketTransmutations).toBe(13)
    expect(fromQueryJson(JSON.stringify(toQueryDocument(query)))).toEqual(query)
    expect(validateQuery(query).valid).toBe(true)
    const chip = boardOf(query).items[0]?.chips[0]
    expect(chip?.details).toContain('within 13 transmutations')
    expect(chip?.tags).toContainEqual({
      text: 'Transmute ≤13',
      style: 'plain',
      tooltip: null,
    })
    const { body } = row(query, requirement.key)
    expect(body.textContent).toContain('Allow transmutations')
    expect(body.textContent).toContain('At most 13')
    expect(body.textContent).toContain(
      'Matches an initial offer or any of the next 13 trinkets.'
    )
    expect(body.textContent).not.toContain('Choose matching trinket at +3')
    for (const count of [-1, 14, 1.5, '1', null])
      expect(() =>
        fromQueryJson(
          JSON.stringify({
            requirements: [
              { item: 'rat_skull', trinket_transmutations: count },
            ],
          })
        )
      ).toThrow('trinket_transmutations')
  })

  it('marks matched transmutations by their exact positions in Analyze', () => {
    const drawn = band(trinketsWith((index) => index === 4 || index === 16))
    const order = itemsByCategory.trinket
    const labels = [
      ...drawn.querySelectorAll('[data-transmutation-order] [aria-label]'),
    ].map((element) => element.getAttribute('aria-label'))
    expect(labels).toHaveLength(13)
    expect(labels[0]).toBe(`1. ${order[4]?.name}, used by the query`)
    expect(labels[12]).toBe(`13. ${order[16]?.name}, used by the query`)
    expect(
      labels.filter((label) => label?.endsWith('used by the query'))
    ).toHaveLength(2)
  })

  it('persists choosing a trinket and draws the four offers as one choice', () => {
    const query = fromQueryJson(
      '{"requirements":[{"any_of":[{"item":"mimic_tooth","select_trinket":true},{"item":"rat_skull"}]}]}'
    )
    expect(query.requirements[0]?.selectTrinket).toBe(true)
    expect(fromQueryJson(JSON.stringify(toQueryDocument(query)))).toEqual(query)
    const order = itemsByCategory.trinket
    const chosen = band(trinketsWith(() => false, order[1]?.id ?? null))
    const offers = [
      ...chosen.querySelectorAll('[data-trinket-choice] [role="radio"]'),
    ]
    expect(chosen.querySelector('select')).toBeNull()
    expect(offers.map((offer) => offer.getAttribute('aria-label'))).toEqual(
      order.slice(0, 4).map((item) => item.name)
    )
    expect(offers.map((offer) => offer.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ])
    expect(chosen.textContent).toContain(`generated with ${order[1]?.name}`)
    const busy = band(
      trinketsWith(() => false),
      true
    )
    expect(
      [...busy.querySelectorAll('[role="radio"]')].every((offer) =>
        offer.hasAttribute('disabled')
      )
    ).toBe(true)
    expect(busy.textContent).toContain('Regenerating floors')
    expect(busy.querySelector('[aria-checked="true"]')).toBeNull()
  })

  it('names every trinket in title case', () => {
    expect(itemsByCategory.trinket).toHaveLength(17)
    for (const trinket of itemsByCategory.trinket)
      expect(trinket.name).toBe(
        trinket.name.replace(/\b\w/g, (letter) => letter.toUpperCase())
      )
  })

  it('requires a named trinket and shows no details or wildcard controls', () => {
    const query = fromQueryJson(
      '{"requirements":[{"kind":"trinket","source":"locked_chest","max_depth":2}]}'
    )
    expect(boardOf(query).items[0]?.chips[0]?.title).toBe('Trinket')
    expect(boardOf(query).items[0]?.problem).not.toBeNull()
    // The sheet names the first trinket and shows no filters for it, but
    // keeps the source and floor limit the row carried.
    const sheet = sheetOn(query, { type: 'row', key: 1 })
    expect(sheet.form.item.value).toBe('rat_skull')
    const saved = saveSheet(query, sheet)
    if (!saved.ok || !('saved' in saved.value))
      throw new Error('the sheet did not save')
    expect(saved.value.saved.requirements[0]).toMatchObject({
      key: 1,
      kind: 'trinket',
      item: 'rat_skull',
      source: 'locked_chest',
      maxDepth: 2,
    })
    const { subject, body } = drawSheet(sheet)
    expect(subject).toBe('Rat Skull')
    expect(body.textContent).toContain('Choose matching trinket at +3')
    expect(body.textContent).not.toContain('Any trinket')
    expect(body.querySelector('select[aria-label="Source"]')).toBeNull()
    expect(body.textContent).not.toContain('Limit this item')
    expect(
      body.querySelectorAll('select[aria-label="Trinket"] option')
    ).toHaveLength(17)
  })

  it('joins named trinkets into an OR group and persists them as offered predicates', () => {
    const state = fromQueryJson(
      '{"requirements":[{"item":"mimic_tooth"},{"item":"rat_skull"}]}'
    )
    const joined = editBoard(state, [{ type: 'join', source: 2, target: 1 }])
    if (!joined.ok) throw new Error(joined.error)
    state.requirements = joined.value.requirements
    expect(validateQuery(state).valid).toBe(true)
    const document = toQueryDocument(state)
    expect(document.requirements).toHaveLength(1)
    expect(document.requirements[0]).toHaveProperty('any_of')
    expect(boardOf(state).items[0]?.chips[0]?.stack.can_grow).toBe(false)
    expect(
      fromQueryJson(JSON.stringify(document))
        .requirements.map((requirement) => requirement.item ?? '')
        .sort()
    ).toEqual(['mimic_tooth', 'rat_skull'])
  })
})
