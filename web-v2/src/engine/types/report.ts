// The `seed_report` document, schema version 1 (docs/seed-report-format.md).
// Fields of a section the report does not list in `sections` are absent, so
// every section-gated field is optional here.

import type { RoomType } from '../../shared/game/floor-requirements'
import type { Accessibility, FloorFeeling, QuestName } from './engine'
import type { ChallengeName, QueryDocument } from './query'

export const SEED_REPORT_FORMAT = 'seed-seeker-seed-report'
export const SEED_REPORT_SCHEMA_VERSION = 1

/** Every section of schema version 1, in the document's order. */
export const SEED_REPORT_SECTIONS = [
  'identities',
  'ringGems',
  'trinketOffers',
  'artifactDecks',
  'feelings',
  'rooms',
  'equipment',
  'quests',
  'branches',
  'allItems',
  'trinketTiming',
  'alchemyPots',
  'builders',
  'questRewardSlots',
  'encounters',
] as const

export type SeedReportSection = (typeof SEED_REPORT_SECTIONS)[number]

export interface SeedReportRequest {
  /** A seed code in any case or grouping, or a UTC daily date `YYYY-MM-DD`. */
  seed: string
  challenges?: ChallengeName[]
  /** One of the four Catalyst offers by id, or `"none"` for No Trinket. */
  trinket?: string
  /** A query document; selects the trinket when `trinket` is absent and marks items. */
  query?: QueryDocument
}

export interface SeedReport {
  format: typeof SEED_REPORT_FORMAT
  schemaVersion: typeof SEED_REPORT_SCHEMA_VERSION
  shpdVersion: string
  shpdCommit: string
  status: 'partial' | 'complete'
  notes: string[]
  sections: SeedReportSection[]
  seed: { code: string; value: number; daily: boolean }
  query?: { matchedRequirements: number; totalRequirements: number }
  identities: {
    scrolls: ReportIdentity[]
    potions: ReportIdentity[]
    rings: ReportIdentity[]
  }
  ringGems: number[]
  trinkets: ReportTrinkets
  floors: ReportFloor[]
  quests: ReportQuest[]
}

export interface ReportIdentity {
  name: string
  appearance: string
  spriteIndex: number
  /** The class's type glyph in `item_icons.png` (x, y, w, h). */
  icon?: [number, number, number, number]
}

export interface ReportItemRef {
  id: string
  name: string
  /** The game's examine text; absent from older engines. */
  description?: string
  spriteIndex: number
  matched: boolean
}

export interface ReportTrinkets {
  offers: ReportItemRef[]
  /** The selected offer id, or null for No Trinket. */
  selected: string | null
  transmutationOrder: ReportItemRef[]
  artifactDecks: { depth: number; order: ReportItemRef[] }[]
  timing?: TrinketTiming
}

export interface TrinketTiming {
  catalystDepth: number
  firstAlchemyPotDepth: number
  firstAlchemyPotSecret: boolean
  selectionDepth: number
  firstEffectiveDepth: number
  /** Index-aligned with `offers`. */
  optionEffects: ('modeled' | 'unmodeled' | 'none')[]
}

export interface ReportFloor {
  depth: number
  /** Absent on boss floors. */
  feeling?: FloorFeeling
  rooms: RoomType[]
  builder?: string
  appearances?: { kind: 'alchemy_pot'; room?: string; secret: boolean }[]
  items: ReportItem[]
  encounters?: ReportEncounter[]
  branches: ReportBranch[]
}

export interface ReportItem {
  id: string
  name: string
  category: string
  /** The game's examine text; absent from older engines. */
  description?: string
  spriteIndex: number
  /** Potions and scrolls: the type glyph's `item_icons.png` rectangle (x, y, w, h). */
  icon?: [number, number, number, number]
  upgrade: number
  effect: { name: string; kind: 'enchantment' | 'curse' } | null
  cursed: boolean
  secret: boolean
  depth: number
  source: string
  accessibility: Accessibility
  matched: boolean
  resinDonor: boolean
  excluded: boolean
  prediction?: 'exact' | 'constrained' | 'variable'
  conditions?: ReportCondition[]
  ranges?: { quantity?: ReportRange; tier?: ReportRange; level?: ReportRange }
}

export interface ReportRange {
  min: number
  max: number
}

export type ReportCondition =
  | { type: 'challenge'; challenge: string; enabled: boolean }
  | { type: 'trinket'; events: TrinketEvent[] }
  | { type: 'artifact'; events: ArtifactEvent[] }
  | { type: 'quest'; quest: QuestName; depth?: number }
  | {
      type: 'choice'
      group: string
      optionCount: number
      selectedCount: number
      favorRequirement?: number
    }
  | { type: 'inventory'; requirement: string }
  | { type: 'runtime'; state: string }

export interface TrinketEvent {
  beforeDepth: number
  kind: 'acquired' | 'upgraded' | 'transmuted'
  trinket?: string
  minUpgrades?: number
}

export interface ArtifactEvent {
  beforeDepth: number
  kind: 'obtained' | 'transmuted'
  artifact: string
}

export interface ReportEncounter {
  mob: string
  quantity: number
  rewards?: EncounterReward[]
}

export interface EncounterReward {
  item?: string
  category: string
  level?: number
  cursed?: boolean
  effect?: string
  prediction: 'guaranteed' | 'runtime_chance' | 'generated_with_floor'
  chance?: { numerator: number; denominator: number }
}

export interface ReportBranch {
  branch: number
  kind: 'blacksmith_crystal' | 'blacksmith_gnoll' | 'imp_vault'
  objective: string
  access: {
    quest: QuestName
    requiresAcceptance: boolean
    requiredItem?: string
  }
}

export interface ReportQuest {
  quest: QuestName
  variant: string
  depth: number
  spawnDepthRange: ReportRange
  rewards: {
    source: string
    optionCount: number
    selectedCount: number
    favorRequirement?: number
  }
  slots?: RewardSlot[]
  upgradesPinned?: boolean
  totalUpgradeValue?: number
}

export interface RewardSlot {
  slot: number
  item: string
  level: number
  levelPinned: boolean
  role?: string
  levelRule?:
    | { type: 'range'; min: number; max: number }
    | { type: 'transfer_upgrade'; transfer: number }
  effect?: string
  candidates?: { item: string; drifts: number[]; weight: number }[]
  scenarioCount: number
}
