import type { RoomType } from '../../shared/game/floor-requirements'
import type {
  ChallengeName,
  ItemCategory,
  ItemSource,
  QueryDocument,
} from './query'

/** The query bounds `SearchQuery::validate` itself applies, plus the
 * results-file limit every frontend must agree on. */
export interface EngineLimits {
  maxDepth: number
  exactTierMin: number
  exactTierMax: number
  boundedTierMin: number
  boundedTierMax: number
  identityGroupMax: number
  levelSumGroupMax: number
  maxUpgradeDefault: number
  maxUpgradeRing: number
  maxUpgradeRingStandard: number
  maxUpgradeWeapon: number
  maxUpgradeAnyTier: number
  extraUpgradeTier: number
  /** The most items one stack of the requirement editor asks for, its anchor included. */
  stackMax: number
  trinketTransmutationsMax: number
  artifactTransmutationsMax: number
  resultsFileMaxBytes: number
}

/** One challenge as the engine lists it, in mask order. */
export interface EngineChallenge {
  name: ChallengeName
  mask: number
  /** True for the challenges the level generator itself consults. */
  changesLevelGeneration: boolean
}

/**
 * The engine's constants document (`engine_info`). The app only reads the
 * first four at runtime; the rest exist so `engine-constants.test.ts` can
 * check the app's local copies of them against the engine.
 */
export interface EngineInfo {
  roomTypes: RoomType[]
  shpdVersion: string
  shpdCommit: string
  totalSeeds: number
  maxResults: number
  limits: EngineLimits
  emptyBossFloors: number[]
  /** Inclusive `[first, last]` depth window per quest. */
  questWindows: Record<QuestName, [number, number]>
  challenges: EngineChallenge[]
  searchStartStride: number
}

export interface ParsedSeed {
  /** Exact result recipe. Null means No Trinket; absent uses the query. */
  selectedTrinket?: string | null
  code: string
  value: number
}

export type AnalysisResult =
  | { valid: false; error: string }
  | {
      valid: true
      probability: number | null
      impossible: boolean
      notes: string[]
    }

export interface SearchAdvance {
  state: 'running' | 'completed'
  tested: number
  matches: ParsedSeed[]
}

export type Accessibility =
  | { type: 'independent' }
  | { type: 'choice'; group: number; option: number }
  | { type: 'scenarios'; group: number; mask: string }

export interface ScoutItem {
  id: string
  name: string
  category: ItemCategory
  /**
   * The item's *catalog* cell, which names the item and never varies by seed.
   * For a ring it is the class's own cell, whose offset from the ring block is
   * the class's glyph; the cell to actually draw comes from `ringGems` below.
   * Resolve both through `itemArt`.
   */
  spriteIndex: number
  upgrade: number
  effect: { name: string; kind: 'enchantment' | 'curse' } | null
  cursed: boolean
  secret: boolean
  depth: number
  source: ItemSource
  accessibility: Accessibility
  matched: boolean
  /** Matched as a surplus wand consumed for Arcane Resin. */
  resinDonor?: boolean
  /**
   * Forbidden to every requirement by the query (a Blacksmith reward while
   * Smith rewards are excluded), so never matched. Missing in cached worker
   * responses from before the flag, which read as not excluded.
   */
  excluded?: boolean
}

export interface ScoutRequest {
  /** Missing uses the query; "none" overrides to no trinket. */
  trinket?: string
  seed: string
  challenges?: ChallengeName[]
  query?: QueryDocument
}

export type QuestName = 'ghost' | 'wandmaker' | 'blacksmith' | 'imp'

/** The three quests the Prison's Wandmaker can roll, in wire-id order. */
export const WANDMAKER_QUESTS = [
  'corpse_dust',
  'elemental_embers',
  'rotberry',
] as const

export type WandmakerQuest = (typeof WANDMAKER_QUESTS)[number]

export type QuestVariant =
  | 'fetid_rat'
  | 'gnoll_trickster'
  | 'great_crab'
  | 'corpse_dust'
  | 'elemental_embers'
  | 'rotberry'
  | 'crystal'
  | 'gnoll'
  // v4.0.0 replaced the Imp's Monk/Golem token hunts with one vault expedition.
  | 'vault'

export interface ScoutQuest {
  quest: QuestName
  variant: QuestVariant
  depth: number
}

export interface TrinketOffer {
  matched?: boolean
  id: string
  name: string
  spriteIndex: number
}

export type FloorFeeling =
  | 'none'
  | 'chasm'
  | 'water'
  | 'grass'
  | 'dark'
  | 'large'
  | 'traps'
  | 'secrets'

export interface ScoutFeeling {
  depth: number
  feeling: FloorFeeling
}

export interface ScoutResult {
  /** Absent only in responses cached before item mappings were exposed. */
  itemMappings?: ItemMappings
  selectedTrinket?: string | null
  /** Optional for responses cached before floor feelings were exposed. */
  feelings?: ScoutFeeling[]
  floorRooms?: { depth: number; rooms: RoomType[] }[]
  /** Full private-deck order; only entries 0..3 are initial catalyst offers. */
  trinketOrder?: TrinketOffer[]
  artifactDecks?: { depth: number; order: TrinketOffer[] }[]
  seed: ParsedSeed
  items: ScoutItem[]
  /**
   * The gem this run draws each ring class with, in catalog ring order. The
   * game shuffles `Ring.gems` once per run, so a seed decides what colour each
   * ring is: an item's ring cell is `RING_SPRITE_BASE` plus its class's entry
   * here. Only items from this scout may be resolved against it.
   */
  ringGems: number[]
  quests: ScoutQuest[]
  matchedRequirements: number
  totalRequirements: number
}

export interface ItemMapping {
  name: string
  appearance: string
  /** Unidentified appearance sprite; already resolved for this seed. */
  spriteIndex: number
}

export interface ItemMappings {
  scrolls: ItemMapping[]
  potions: ItemMapping[]
  rings: ItemMapping[]
}
