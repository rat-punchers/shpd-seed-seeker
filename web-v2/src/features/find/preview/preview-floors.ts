/**
 * What the Find preview shows of a seed: only the floors that hold
 * something the search asked about. A floor is kept for the items the query
 * matched, the rooms and feeling its floor requirements asked for, or a
 * quest giver within the floor limit, with the quest's rewards.
 */
import type {
  FloorFeeling,
  QueryDocument,
  ReportItem,
  ReportQuest,
  SeedReport,
} from '../../../engine/types'
import { isListed, questRewardItems } from '../../analyze/report/floor-items'
import { hasSection } from '../../analyze/report/report-text'

export interface PreviewQuest {
  quest: ReportQuest
  rewards: ReportItem[]
}

export interface PreviewFloor {
  depth: number
  /** Matched items, except those a listed quest shows among its rewards. */
  items: ReportItem[]
  /** Asked-for rooms the floor has, in the order the query lists them. */
  rooms: string[]
  /** The asked-for feeling, when the floor has it. */
  feeling?: FloorFeeling
  quests: PreviewQuest[]
}

function wantedRooms(query: QueryDocument | undefined, depth: number) {
  const floor = query?.floor_requirements?.find(
    (entry) => entry.depth === depth
  )
  return {
    rooms: [...(floor?.rooms ?? []), ...(floor?.any_rooms ?? [])],
    feeling: floor?.feeling,
  }
}

/** The preview's floors, shallowest first; floors with nothing to show are left out. */
export function previewFloors(
  report: SeedReport,
  query: QueryDocument | undefined
): PreviewFloor[] {
  const limit = query?.max_depth ?? Number.POSITIVE_INFINITY
  const quests = hasSection(report, 'quests')
    ? report.quests.filter((quest) => quest.depth <= limit)
    : []
  const floors: PreviewFloor[] = []
  for (const floor of report.floors) {
    const floorQuests = quests
      .filter((quest) => quest.depth === floor.depth)
      .map((quest) => ({
        quest,
        rewards: questRewardItems(report, quest.rewards.source, floor.depth),
      }))
    const questSources = new Set(
      floorQuests.map(({ quest }) => quest.rewards.source)
    )
    const items = floor.items.filter(
      (item) => item.matched && isListed(item) && !questSources.has(item.source)
    )
    const wanted = wantedRooms(query, floor.depth)
    const rooms = hasSection(report, 'rooms')
      ? [...new Set(wanted.rooms)].filter((room) => floor.rooms.includes(room))
      : []
    const feeling =
      wanted.feeling &&
      wanted.feeling !== 'none' &&
      floor.feeling === wanted.feeling
        ? wanted.feeling
        : undefined
    if (
      items.length === 0 &&
      rooms.length === 0 &&
      !feeling &&
      !floorQuests.length
    )
      continue
    floors.push({
      depth: floor.depth,
      items,
      rooms,
      ...(feeling ? { feeling } : {}),
      quests: floorQuests,
    })
  }
  return floors
}
