import { describe, expect, it } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { builtInPresets } from '../../../src/app/store/presets'
import type { BoardResponse, QueryState } from '../../../src/engine/types'
import {
  fromQueryJson,
  requirementFromRow,
  requirementToRow,
  toQueryJson,
} from '../../../src/features/query/query'
import {
  editBoard,
  normalizedQuery,
  requirementBoardOf,
} from '../../../src/features/query/requirements/board'
import { REPO_ROOT } from '../../engine/engine'

// The core's golden answers, whose rows the web's codec must read back.
const fixtures = join(REPO_ROOT, 'crates/seedfinder-core/tests/fixtures/editor')

const boardOf = (query: QueryState) => {
  const answer = requirementBoardOf(query)
  if (!answer.ok) throw new Error(answer.error)
  return answer.value
}

const documentOf = (query: QueryState) =>
  (JSON.parse(toQueryJson(query)) as { requirements: unknown[] }).requirements

describe('the requirement board bridge', () => {
  it('reads every row the core answers and writes it back unchanged', async () => {
    const names = (await readdir(fixtures)).filter((name) =>
      name.startsWith('board-')
    )
    expect(names.length).toBeGreaterThan(10)
    for (const name of names) {
      const { response } = JSON.parse(
        await readFile(join(fixtures, name), 'utf8')
      ) as { response: BoardResponse | { error: string } }
      if ('error' in response) continue
      expect(
        response.rows.map(requirementFromRow).map(requirementToRow)
      ).toEqual(response.rows)
    }
  })

  it('normalizes an imported list, and leaves a canonical one as it was', () => {
    // A lone either/or alternative and a stack labelled out of range.
    const imported = fromQueryJson(
      '{"max_depth":12,"requirements":[{"any_of":[{"kind":"wand","item":"wand_frost"}]},{"kind":"ring","identity_group":7},{"kind":"ring","identity_group":7}]}'
    )
    expect(boardOf(imported).problems).not.toEqual([])
    const normalized = normalizedQuery(imported)
    expect(normalized.maxDepth).toBe(12)
    expect(documentOf(normalized)).toEqual([
      { kind: 'wand', item: 'wand_frost' },
      { kind: 'ring', identity_group: 1 },
      { kind: 'ring', identity_group: 1 },
    ])
    expect(boardOf(normalized).problems).toEqual([])
    expect(normalizedQuery(normalized)).toBe(normalized)
    // The presets a restored list must keep matching are canonical already.
    for (const preset of builtInPresets)
      expect(normalizedQuery(preset.query)).toBe(preset.query)
  })

  it('draws both boards once per change of the requirements', () => {
    const query = fromQueryJson(
      '{"arcane_resin":"auto","requirements":[{"kind":"ring","item":"ring_might","upgrade":2},{"kind":"ring","item":"ring_might"},{"kind":"wand","blanket":true}]}'
    )
    const answer = requirementBoardOf(query)
    // Settings beside the requirements leave the drawn board as it was.
    const deeper: QueryState = { ...query, maxDepth: 12 }
    expect(requirementBoardOf(deeper)).toBe(answer)
    expect(requirementBoardOf({ ...query, arcaneResin: 3 })).not.toBe(answer)
    const board = boardOf(query)
    expect(board.counts).toEqual({ ordinary: 1, blanket: 1 })
    expect(board.items[0]).toMatchObject({
      id: 'r1',
      members: [1],
      extras: [2],
    })
    // The stack's badge and copies are its chip's.
    const ring = board.items[0]?.chips[0]
    expect(ring).toMatchObject({ copies: [2], badges: { total: null } })
    expect(ring?.badges.count?.text).toBe('×2')
    expect(board.resin?.tags[0]?.text).toBe('Auto')
  })

  it('joins, refuses and saves through the core, keeping the list when nothing changed', () => {
    const query = fromQueryJson(
      '{"requirements":[{"kind":"ring","item":"ring_might","upgrade":2},{"kind":"ring","item":"ring_might"},{"kind":"wand"},{"kind":"wand","item":"wand_frost"}]}'
    )
    // A stack across categories: the ring keeps its stack as a member, whose
    // copies each keep the ring's kind.
    const across = editBoard(query, [{ type: 'join', source: 3, target: 1 }])
    if (!across.ok) throw new Error(across.error)
    expect(across.value.refused).toBeNull()
    expect(
      documentOf({ ...query, requirements: across.value.requirements })
    ).toEqual([
      {
        any_of: [
          { kind: 'ring', item: 'ring_might', upgrade: 2, identity_group: 1 },
          { kind: 'wand' },
        ],
      },
      { kind: 'ring', identity_group: 1 },
      { kind: 'wand', item: 'wand_frost' },
    ])

    // Every stack label in use: a join onto a stack is refused, and the list stays.
    const crowded = fromQueryJson(
      JSON.stringify({
        requirements: [
          ...['wand', 'armor', 'ring', 'weapon'].flatMap((kind, index) => [
            { kind, upgrade: 1, identity_group: index + 1 },
            { kind, identity_group: index + 1 },
          ]),
          { kind: 'wand', item: 'wand_frost' },
          { kind: 'wand', item: 'wand_frost' },
          { kind: 'wand', item: 'wand_disintegration' },
        ],
      })
    )
    expect(
      editBoard(crowded, [{ type: 'join', source: 11, target: 9 }])
    ).toEqual({
      ok: true,
      value: {
        requirements: crowded.requirements,
        changed: false,
        refused: {
          reason: 'no_free_group',
          message:
            'Every group label is in use. Remove a stack or a combined level first.',
        },
        rekeyed: [],
      },
    })
    const same = editBoard(query, [{ type: 'join', source: 3, target: 3 }])
    expect(same.ok && same.value.requirements).toBe(query.requirements)

    const joined = editBoard(query, [{ type: 'join', source: 4, target: 3 }])
    if (!joined.ok) throw new Error(joined.error)
    const cluster = { ...query, requirements: joined.value.requirements }
    expect(documentOf(cluster)).toEqual([
      { kind: 'ring', item: 'ring_might', upgrade: 2 },
      { kind: 'ring', item: 'ring_might' },
      { any_of: [{ kind: 'wand' }, { kind: 'wand', item: 'wand_frost' }] },
    ])
    expect(boardOf(cluster).items[1]).toMatchObject({
      id: 'c1',
      label: 'Any of 2',
    })

    const saved = editBoard(cluster, [
      {
        type: 'save',
        key: null,
        requirement: { kind: 'armor' },
        count: 2,
        total: null,
        copy_depth: 6,
      },
    ])
    if (!saved.ok) throw new Error(saved.error)
    const added = saved.value.requirements.slice(cluster.requirements.length)
    expect(added.map((requirement) => requirement.kind)).toEqual([
      'armor',
      'armor',
    ])
    // New rows take keys no row of the list holds.
    const keys = saved.value.requirements.map((requirement) => requirement.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(
      Math.min(...added.map((requirement) => requirement.key))
    ).toBeGreaterThan(4)
  })
})
