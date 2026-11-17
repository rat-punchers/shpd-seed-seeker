import { beforeAll, describe, expect, it } from 'bun:test'
import type { AnalysisResult, RequirementKind } from '../../../src/engine/types'
import { analyzeQuery } from '../../../src/engine/wasm'
import { fromSimple } from '../../../src/features/find/simple'
import {
  requiresItem,
  upgradeLevels,
} from '../../../src/features/find/simple-items'
import { itemList } from '../../../src/features/query/item-list'
import {
  defaultQueryState,
  toQueryJson,
} from '../../../src/features/query/query'
import {
  changeSheet,
  openSheet,
} from '../../../src/features/query/requirements/sheet'
import { loadEngine } from '../../engine/engine'

beforeAll(loadEngine)

const KINDS = itemList().kinds

/** The items Simple's menu names for `kind`. */
const itemsForKind = (kind: RequirementKind): string[] =>
  itemList()
    .groups.flatMap((group) => group.items)
    .flatMap((choice) =>
      choice.kind === kind && choice.item ? [choice.item] : []
    )

/** The engine's answer for one Simple row of `kind`. */
const analyzeRow = (
  kind: RequirementKind,
  item?: string,
  minUpgrade?: number
): Promise<AnalysisResult> =>
  analyzeQuery(
    toQueryJson(
      fromSimple({
        matchMode: 'all',
        maxDepth: 24,
        constraints: [
          {
            key: 1,
            kind,
            ...(item ? { item } : {}),
            ...(minUpgrade ? { minUpgrade } : {}),
          },
        ],
      })
    )
  )

describe('the Simple menus offer only what the engine accepts', () => {
  for (const kind of KINDS) {
    it(`${kind}: every item and every offered upgrade`, async () => {
      const items = itemsForKind(kind)
      // "Any weapon" names no items of its own: they sit under melee and thrown.
      if (kind !== 'weapon') expect(items.length).toBeGreaterThan(0)
      const choices: [string | undefined, number | undefined][] = []
      for (const item of [
        ...(requiresItem(kind) ? [] : [undefined]),
        ...items,
      ]) {
        choices.push([item, undefined])
        for (const level of upgradeLevels(kind, item))
          choices.push([item, level])
      }
      for (const [item, level] of choices) {
        const answer = await analyzeRow(kind, item, level)
        expect({ item, level, valid: answer.valid }).toEqual({
          item,
          level,
          valid: true,
        })
      }
    })
  }

  it('stops at the highest upgrade the engine accepts', async () => {
    for (const kind of KINDS) {
      for (const item of [undefined, itemsForKind(kind)[0]]) {
        const levels = upgradeLevels(kind, item)
        if (levels.length === 0) continue
        const next = Math.max(...levels) + 1
        const answer = await analyzeRow(kind, item, next)
        expect({ kind, item, next, valid: answer.valid }).toEqual({
          kind,
          item,
          next,
          valid: false,
        })
      }
    }
  })

  it('names an item for trinkets and artifacts, as the engine requires', async () => {
    for (const kind of KINDS) {
      const answer = await analyzeRow(kind)
      expect({ kind, valid: answer.valid }).toEqual({
        kind,
        valid: !requiresItem(kind),
      })
    }
  })
})

describe("Simple's menu is the Advanced sheet's list", () => {
  it('names every item each family of the sheet offers, and nothing else', () => {
    const opened = openSheet(defaultQueryState(), {
      type: 'new',
      blanket: false,
    })
    if (!opened.ok) throw new Error(opened.error)
    const sheetItems = new Set<string>()
    for (const option of opened.value.form.category.options) {
      const answer = changeSheet(opened.value, {
        type: 'set_category',
        value: option.value,
      })
      if (!answer.ok) throw new Error(answer.error)
      for (const item of answer.value.form.item.options)
        if (item.value && !item.hidden && item.value !== 'arcane_resin')
          sheetItems.add(item.value)
    }
    const simpleItems = KINDS.flatMap(itemsForKind)
    expect(new Set(simpleItems).size).toBe(simpleItems.length)
    expect(new Set(simpleItems)).toEqual(sheetItems)
  })

  it('lists every artifact, and no starting gear or tipped darts', () => {
    const named = KINDS.flatMap(itemsForKind)
    expect(itemsForKind('artifact')).toContain('skeleton_key')
    for (const absent of ['cloth_armor', 'dagger', 'worn_shortsword'])
      expect(named).not.toContain(absent)
    expect(named.filter((item) => item.endsWith('_dart'))).toEqual([])
  })
})
