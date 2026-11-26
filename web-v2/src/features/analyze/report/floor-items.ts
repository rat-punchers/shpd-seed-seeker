/**
 * Quest loot goes to its quest card, shop stock to its own group, and the
 * remaining floor items split into notable and other items.
 */
import type {
  ReportFloor,
  ReportItem,
  ReportQuest,
  SeedReport,
} from '../../../engine/types/report'
import { hasSection } from './report-text'

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

/** The floor's item lists, leaving loot to the quest cards that show it. */
export function floorItemGroups(
  floor: ReportFloor,
  report: SeedReport
): FloorItemGroups {
  const quests = hasSection(report, 'quests')
    ? report.quests.filter((quest) => quest.depth === floor.depth)
    : []
  const groups: FloorItemGroups = { notable: [], other: [], shop: [] }
  for (const item of floor.items) {
    if (!isListed(item)) continue
    if (quests.some((quest) => questItemGroup(item, quest))) continue
    if (item.source === 'shop') groups.shop.push(item)
    else if (isNotable(item)) groups.notable.push(item)
    else groups.other.push(item)
  }
  return groups
}

export interface QuestItemGroups {
  rewards: ReportItem[]
  vaultTreasure: ReportItem[]
}

export function questItemGroup(
  item: ReportItem,
  quest: ReportQuest
): keyof QuestItemGroups | undefined {
  if (item.source === quest.rewards.source) return 'rewards'
  if (quest.quest === 'imp' && item.source === 'vault_treasure')
    return 'vaultTreasure'
}

export function questItemGroups(
  floor: ReportFloor,
  quest: ReportQuest
): QuestItemGroups {
  const groups: QuestItemGroups = { rewards: [], vaultTreasure: [] }
  for (const item of floor.items) {
    const group = questItemGroup(item, quest)
    if (group) groups[group].push(item)
  }
  return groups
}
