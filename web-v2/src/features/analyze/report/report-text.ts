// Player-facing words for report values.
import type { ItemSource, QuestName } from '../../../engine/types'
import type {
  ReportBranch,
  ReportItem,
  SeedReport,
} from '../../../engine/types/report'
import { getItem, sourceLabel } from '../../../shared/game/catalog'

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

export interface ItemTitleParts {
  /** A weapon effect, which the game's templates put before the name. */
  prefix: string | null
  name: string
  /** An armor glyph or curse: ` of thorns`. */
  suffix: string | null
  /** `+4` or `-1`; null at +0. */
  upgrade: string | null
}

/** The game's title order: `Shocking assassin's blade +4`, `Plate armor of thorns +3`. */
export function itemTitleParts(item: ReportItem): ItemTitleParts {
  const upgrade =
    item.upgrade > 0
      ? `+${item.upgrade}`
      : item.upgrade < 0
        ? String(item.upgrade)
        : null
  const effect = item.effect?.name
  if (!effect) return { prefix: null, name: item.name, suffix: null, upgrade }
  if (item.category === 'armor') {
    return {
      prefix: null,
      name: item.name,
      suffix: ` of ${effect.toLowerCase()}`,
      upgrade,
    }
  }
  return {
    prefix: `${effect} `,
    name: item.name.charAt(0).toLowerCase() + item.name.slice(1),
    suffix: null,
    upgrade,
  }
}

/** The item's name as the game titles it: effect and upgrade included. */
export function itemTitle(item: ReportItem): string {
  const { prefix, name, suffix, upgrade } = itemTitleParts(item)
  return `${prefix ?? ''}${name}${suffix ?? ''}${upgrade ? ` ${upgrade}` : ''}`
}

/** Whether a report lists a section, so its fields can be read. */
export function hasSection(
  report: SeedReport,
  section: SeedReport['sections'][number]
): boolean {
  return report.sections.includes(section)
}
