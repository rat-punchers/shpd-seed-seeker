/**
 * How a floor's items are grouped on screen: quest rewards go to their
 * quest card, shop stock to its own group, and the rest splits into notable
 * and other items. Shared by the floor sections and the floor strip.
 */
import type {
  ReportFloor,
  ReportItem,
  SeedReport,
} from '../../../engine/types/report'
import { hasSection, QUEST_REWARD_SOURCES } from './report-text'

/** Notable at any upgrade. */
const ALWAYS_CATEGORIES = new Set(['wand', 'ring', 'artifact', 'trinket'])

/** Notable at +1 or better. */
const EQUIPMENT_CATEGORIES = new Set(['weapon', 'armor'])

/** Notable items whose category does not say so: progression consumables. */
const ALWAYS_ITEMS = new Set([
  'potion_of_strength',
  'potion_of_experience',
  'scroll_of_upgrade',
  'scroll_of_transmutation',
  'stone_of_enchantment',
  'arcane_stylus',
  'stylus',
  'trinket_catalyst',
])

function upgraded(item: ReportItem): boolean {
  return Math.max(item.upgrade, item.ranges?.level?.max ?? 0) >= 1
}

/**
 * Items the query matched; wands, rings, artifacts and trinkets; strength,
 * experience, upgrade, transmutation, enchantment and stylus; and weapons or
 * armor at +1 or better.
 */
export function isNotable(item: ReportItem): boolean {
  if (item.matched) return true
  if (ALWAYS_CATEGORIES.has(item.category)) return true
  if (EQUIPMENT_CATEGORIES.has(item.category) && upgraded(item)) return true
  return ALWAYS_ITEMS.has(item.id)
}

export interface FloorItemGroups {
  notable: ReportItem[]
  other: ReportItem[]
  shop: ReportItem[]
}

/** Gold piles, dungeon keys and quest items are not listed; the map shows them. */
const HIDDEN_CATEGORIES = new Set(['gold', 'key'])
const QUEST_ITEMS = new Set(['ceremonial_candle', 'corpse_dust', 'embers'])

export function isListed(item: ReportItem): boolean {
  return !HIDDEN_CATEGORIES.has(item.category) && !QUEST_ITEMS.has(item.id)
}

/**
 * The floor's item lists, without gold, keys and quest items. Quest rewards are left out
 * when the report lists quests, because each quest card shows its own.
 */
export function floorItemGroups(
  floor: ReportFloor,
  report: SeedReport
): FloorItemGroups {
  const questCards = hasSection(report, 'quests')
  const groups: FloorItemGroups = { notable: [], other: [], shop: [] }
  for (const item of floor.items) {
    if (!isListed(item)) continue
    if (questCards && QUEST_REWARD_SOURCES.includes(item.source)) continue
    if (item.source === 'shop') groups.shop.push(item)
    else if (isNotable(item)) groups.notable.push(item)
    else groups.other.push(item)
  }
  return groups
}

/** A quest's reward items, from the floor its giver stands on. */
export function questRewardItems(
  report: SeedReport,
  source: string,
  depth: number
): ReportItem[] {
  const floor = report.floors.find((entry) => entry.depth === depth)
  return (floor?.items ?? []).filter((item) => item.source === source)
}
