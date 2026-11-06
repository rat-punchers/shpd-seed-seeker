import { beforeAll, describe, expect, it } from 'bun:test'
import type { AnalysisResult } from '../../../src/engine/types'
import { analyzeQuery } from '../../../src/engine/wasm'
import { fromSimple } from '../../../src/features/find/simple'
import {
  itemsForKind,
  requiresItem,
  SIMPLE_KINDS,
  upgradeLevels,
} from '../../../src/features/find/simple-items'
import { toQueryJson } from '../../../src/features/query/query'
import { loadEngine } from '../../engine/engine'

beforeAll(loadEngine)

/** The engine's answer for one Simple row of `kind`. */
const analyzeRow = (
  kind: (typeof SIMPLE_KINDS)[number]['kind'],
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
  for (const { kind } of SIMPLE_KINDS) {
    it(`${kind}: every item and every offered upgrade`, async () => {
      const items = itemsForKind(kind)
      expect(items.length).toBeGreaterThan(0)
      const choices: [string | undefined, number | undefined][] = []
      for (const item of [
        ...(requiresItem(kind) ? [] : [undefined]),
        ...items.map((entry) => entry.id),
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
    for (const { kind } of SIMPLE_KINDS) {
      for (const item of [undefined, itemsForKind(kind)[0]?.id]) {
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
    for (const { kind } of SIMPLE_KINDS) {
      const answer = await analyzeRow(kind)
      expect({ kind, valid: answer.valid }).toEqual({
        kind,
        valid: !requiresItem(kind),
      })
    }
  })
})
