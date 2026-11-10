import type { RoomType } from '../../shared/game/floor-requirements'
import type { ChallengeName, ItemCategory } from './query'

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
  /** Highest searchable upgrade per item family. */
  maxUpgradeByKind: Record<ItemCategory, number>
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
  /** What `level_map` draws: main floors, and quest branches at these depths. */
  levelMaps: {
    schemaVersion: number
    supportedDepths: number[]
    branches: number[]
    branchDepths: number[]
    tileSize: number
  }
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

export type QuestName = 'ghost' | 'wandmaker' | 'blacksmith' | 'imp'

/** The three quests the Prison's Wandmaker can roll, in wire-id order. */
export const WANDMAKER_QUESTS = [
  'corpse_dust',
  'elemental_embers',
  'rotberry',
] as const

export type WandmakerQuest = (typeof WANDMAKER_QUESTS)[number]

export type FloorFeeling =
  | 'none'
  | 'chasm'
  | 'water'
  | 'grass'
  | 'dark'
  | 'large'
  | 'traps'
  | 'secrets'
