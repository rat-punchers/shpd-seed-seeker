// Player-facing words for report values.
import type { ItemSource, QuestName } from '../../../engine/types'
import type {
  ArtifactEvent,
  ReportBranch,
  ReportCondition,
  ReportItem,
  SeedReport,
  TrinketEvent,
} from '../../../engine/types/report'
import { challenges, getItem, sourceLabel } from '../../../shared/game/catalog'

/** `elemental_embers` → `Elemental Embers`. */
export function humanize(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** An item id's catalog name, else the id in words. */
export function itemName(id: string): string {
  return getItem(id)?.name ?? humanize(id)
}

const QUEST_TITLES: Record<QuestName, string> = {
  ghost: 'Sad Ghost',
  wandmaker: 'Old Wandmaker',
  blacksmith: 'Troll Blacksmith',
  imp: 'Ambitious Imp',
}

export function questTitle(quest: QuestName): string {
  return QUEST_TITLES[quest]
}

/** The sources that hold quest rewards; quest cards list those items. */
export const QUEST_REWARD_SOURCES: readonly string[] = [
  'ghost_reward',
  'wandmaker_reward',
  'blacksmith_reward',
  'imp_reward',
]

export function branchTitle(kind: ReportBranch['kind']): string {
  switch (kind) {
    case 'blacksmith_crystal':
      return 'Crystal Mine'
    case 'blacksmith_gnoll':
      return 'Gnoll Mine'
    case 'imp_vault':
      return 'Imp Vault'
  }
}

/** Where to look for an item on its floor. */
export function itemLocation(item: ReportItem): string {
  const where = sourceLabel(item.source as ItemSource)
  return item.secret ? `${where}, in a secret room` : where
}

/** The item's name as a slot reads it: upgrade, effect and curse included. */
export function itemTitle(item: ReportItem): string {
  const upgrade = item.upgrade > 0 ? ` +${item.upgrade}` : ''
  const upgraded =
    item.upgrade < 0 ? `${item.name} ${item.upgrade}` : `${item.name}${upgrade}`
  return item.effect ? `${upgraded}, ${item.effect.name}` : upgraded
}

/** Whether a report lists a section, so its fields can be read. */
export function hasSection(
  report: SeedReport,
  section: SeedReport['sections'][number]
): boolean {
  return report.sections.includes(section)
}

export function challengeName(name: string): string {
  return (
    challenges.find((entry) => entry.value === name)?.label ?? humanize(name)
  )
}

function trinketEvents(events: TrinketEvent[]): string {
  if (events.length === 0) return 'no generation-affecting trinket is held'
  let level = 0
  return events
    .map((event) => {
      if (event.kind === 'upgraded') {
        level += 1
        return `the held trinket reaches +${level} before floor ${event.beforeDepth}`
      }
      level = 0
      const trinket = event.trinket ? itemName(event.trinket) : 'a trinket'
      const atLeast = event.minUpgrades
        ? ` at +${event.minUpgrades} or better`
        : ''
      return `${trinket} is ${event.kind}${atLeast} before floor ${event.beforeDepth}`
    })
    .join(' and ')
}

function artifactEvents(events: ArtifactEvent[]): string {
  if (events.length === 0) return 'no artifact history changes the result'
  return events
    .map(
      (event) =>
        `${itemName(event.artifact)} is ${event.kind} before floor ${event.beforeDepth}`
    )
    .join(' and ')
}

/** One condition an item depends on, as a sentence fragment. */
export function conditionDescription(condition: ReportCondition): string {
  switch (condition.type) {
    case 'challenge':
      return `${challengeName(condition.challenge)} is ${condition.enabled ? 'enabled' : 'disabled'}`
    case 'trinket':
      return trinketEvents(condition.events)
    case 'artifact':
      return artifactEvents(condition.events)
    case 'quest': {
      const when = condition.depth ? ` before floor ${condition.depth}` : ''
      if (condition.quest === 'imp') {
        return `the Ambitious Imp vault is completed with a score above 2000${when}`
      }
      return `the ${questTitle(condition.quest)} quest is completed${when}`
    }
    case 'choice': {
      const favor = condition.favorRequirement
        ? ` with ${condition.favorRequirement} favor`
        : ''
      return `choose ${condition.selectedCount} of ${condition.optionCount} ${humanize(condition.group)} options${favor}`
    }
    case 'inventory':
      return `you carry ${itemName(condition.requirement)}`
    case 'runtime':
      return `${humanize(condition.state)} applies during play`
  }
}

export function predictionLabel(prediction: ReportItem['prediction']): string {
  switch (prediction) {
    case 'exact':
      return 'Fixed by the seed'
    case 'constrained':
      return 'Fixed by the seed when its conditions hold'
    case 'variable':
      return 'Varies with gameplay'
    default:
      return ''
  }
}
