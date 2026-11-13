import { describe, expect, it } from 'bun:test'
import type { QueryDocument, SeedReport } from '../../../src/engine/types'
import { previewFloors } from '../../../src/features/find/preview/preview-floors'
import { realReport } from '../analyze/fixtures'

const fixture = await realReport('aaa-aaa-aaa.json')

/** The fixture with the first item of `source` on `depth` marked matched. */
function withMatch(
  report: SeedReport,
  depth: number,
  source?: string
): SeedReport {
  let marked = false
  return {
    ...report,
    floors: report.floors.map((floor) => ({
      ...floor,
      items: floor.items.map((item) => {
        if (marked || floor.depth !== depth) return item
        if (source !== undefined && item.source !== source) return item
        if (item.category === 'gold' || item.category === 'key') return item
        marked = true
        return { ...item, matched: true }
      }),
    })),
  }
}

const depths = (report: SeedReport, query?: QueryDocument) =>
  previewFloors(report, query).map((floor) => floor.depth)

describe('the Find preview floors', () => {
  it('keeps only quest floors when nothing else matched', () => {
    expect(depths(fixture)).toEqual([3, 9, 13, 19])
    const ghost = previewFloors(fixture, undefined)[0]?.quests[0]
    expect(ghost?.quest.quest).toBe('ghost')
    expect(ghost?.rewards.map((item) => item.source)).toEqual([
      'ghost_reward',
      'ghost_reward',
    ])
  })

  it('leaves out quests beyond the floor limit', () => {
    expect(depths(fixture, { requirements: [], max_depth: 10 })).toEqual([3, 9])
  })

  it('lists matched items, leaving quest rewards to their quest', () => {
    const report = withMatch(withMatch(fixture, 4), 3, 'ghost_reward')
    const floors = previewFloors(report, { requirements: [], max_depth: 10 })
    expect(floors.map((floor) => floor.depth)).toEqual([3, 4, 9])
    expect(floors[0]?.items).toEqual([])
    expect(floors[0]?.quests[0]?.rewards.some((item) => item.matched)).toBe(
      true
    )
    expect(floors[1]?.items).toHaveLength(1)
    expect(floors[1]?.items[0]?.matched).toBe(true)
  })

  it('shows the asked-for rooms and feeling a floor has', () => {
    const floors = previewFloors(fixture, {
      requirements: [],
      max_depth: 10,
      floor_requirements: [
        {
          depth: 4,
          feeling: 'water',
          rooms: ['laboratory', 'garden'],
          any_rooms: ['secret_garden', 'laboratory'],
        },
        // Floor 8 has no feeling and no garden.
        { depth: 8, feeling: 'water', any_rooms: ['garden'] },
      ],
    })
    expect(floors.map((floor) => floor.depth)).toEqual([3, 4, 9])
    expect(floors[1]).toMatchObject({
      depth: 4,
      feeling: 'water',
      rooms: ['laboratory', 'secret_garden'],
      items: [],
      quests: [],
    })
  })
})
