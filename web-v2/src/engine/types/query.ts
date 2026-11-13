import type { RoomType } from '../../shared/game/floor-requirements'
import type { FloorFeeling, WandmakerQuest } from './engine'

export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'wand'
  | 'ring'
  | 'trinket'
  | 'artifact'

/** Melee/thrown classification carried by weapon catalog entries. */
export type WeaponClass = 'melee' | 'thrown'

/**
 * Category filter of one requirement. `weapon` matches melee and thrown
 * weapons alike (the historical behavior); the two narrowed kinds restrict a
 * weapon requirement to one class.
 */
export type RequirementKind = ItemCategory | 'melee_weapon' | 'thrown_weapon'

export type ChallengeName =
  | 'on_diet'
  | 'faith_is_my_armor'
  | 'pharmacophobia'
  | 'barren_land'
  | 'swarm_intelligence'
  | 'into_darkness'
  | 'forbidden_runes'
  | 'hostile_champions'
  | 'badder_bosses'

export type ItemSource =
  | 'heap'
  | 'chest'
  | 'locked_chest'
  | 'crystal_chest'
  | 'tomb'
  | 'skeleton'
  | 'sacrificial_fire'
  | 'mimic'
  | 'golden_mimic'
  | 'crystal_mimic'
  | 'statue'
  | 'armored_statue'
  | 'shop'
  | 'ghost_reward'
  | 'wandmaker_reward'
  | 'blacksmith_reward'
  | 'imp_reward'
  | 'vault_treasure'

export interface TierFilter {
  mode: 'any' | 'exact' | 'at_least' | 'at_most'
  value: number
}

export interface UpgradeFilter {
  mode: 'any' | 'exact' | 'at_least'
  value: number
}

/** The effect shorthand standing for every non-curse effect of the item's family. */
export const ANY_ENCHANTMENT = 'any_enchantment'

/**
 * Which effects an item may carry: one wire name (e.g. `"Blazing"`), a list of
 * same-family wire names in catalog order, or `ANY_ENCHANTMENT`. Absent means
 * any effect or none. This is the document's own shape, so old presets that
 * store a bare name load unchanged.
 */
export type EffectFilter = string | string[]

/**
 * Membership in a combined-level group: some subset of the group's members,
 * filled by distinct items, must reach `atLeast` combined levels, where an
 * item counts as its upgrade plus one. Members are optional — one +2 ring
 * satisfies a two-member group asking for three levels.
 */
export interface LevelSum {
  group: number
  atLeast: number
}

export interface RequirementState {
  /**
   * The row's identity for the requirement editor, stable across its edits.
   * `fromQueryJson` numbers a loaded list 1…n and the editor mints the rest;
   * it is never written to a query document.
   */
  key: number
  /** Reserve this wand without budgeting Auto resin upgrades. */
  excludeResin?: boolean
  /** Extra filter on an item assigned to an ordinary requirement. */
  blanket?: boolean
  selectTrinket?: boolean
  /** Maximum transmutations (1–13), including initial offers; absent/zero requires an offer. */
  trinketTransmutations?: number
  artifactTransmutations?: number
  kind?: RequirementKind
  item?: string
  tier: TierFilter
  upgrade: UpgradeFilter
  effect?: EffectFilter
  uncursed: boolean
  source?: ItemSource
  identityGroup?: number
  maxDepth?: number
  /** Requirements sharing a number form one "any of these" slot. */
  alternativeGroup?: number
  levelSum?: LevelSum
}

export interface FloorRequirement {
  depth: number
  feeling?: FloorFeeling
  rooms?: RoomType[]
  any_rooms?: RoomType[]
}

export interface QueryState {
  floorRequirements?: FloorRequirement[]
  /** Minimum resin, or Auto to upgrade the matched wands to +3. Zero disables it. */
  arcaneResin?: ArcaneResinAmount
  arcaneResinFilter?: ArcaneResinFilter
  autoApplyTrinket: boolean
  requirements: RequirementState[]
  maxDepth: number
  requireBlacksmith: boolean
  excludeBlacksmithRewards: boolean
  /** Which Wandmaker quest a seed must roll; undefined matches any. */
  wandmakerQuest?: WandmakerQuest
  challenges: ChallengeName[]
}

export type ArcaneResinAmount = number | 'auto'

export interface ArcaneResinFilter {
  includeMageWand?: boolean
  uncursed: boolean
  maxDepth?: number
  source?: ItemSource
}

export type TierDocument =
  | 'any'
  | { exact: number }
  | { at_least: number }
  | { at_most: number }
export type UpgradeDocument =
  | number
  | 'any'
  | { exact: number }
  | { at_least: number }

export interface RequirementDocument {
  exclude_resin?: boolean
  blanket?: boolean
  select_trinket?: boolean
  trinket_transmutations?: number
  artifact_transmutations?: number
  kind?: RequirementKind
  item?: string
  tier?: TierDocument
  upgrade?: UpgradeDocument
  effect?: EffectFilter
  uncursed?: true
  source?: ItemSource
  identity_group?: number
  max_depth?: number
  level_sum?: { group: number; at_least: number }
}

/** An "any of these" slot: satisfied by any single member. Members may not carry `level_sum`. */
export interface AnyOfDocument {
  any_of: RequirementDocument[]
}

export type RequirementEntryDocument = RequirementDocument | AnyOfDocument

/** The keys this release writes. Documents saved by older releases may carry
 * retired keys such as `fast_mode`; both the engine's codec and `fromQueryJson`
 * accept and ignore them. */
export interface QueryDocument {
  floor_requirements?: FloorRequirement[]
  arcane_resin?: ArcaneResinAmount
  arcane_resin_filter?: {
    uncursed?: boolean
    max_depth?: number
    source?: ItemSource
    include_mage_wand?: boolean
  }
  auto_apply_trinket?: boolean
  requirements: RequirementEntryDocument[]
  max_depth?: number
  require_blacksmith?: true
  exclude_blacksmith_rewards?: true
  wandmaker_quest?: WandmakerQuest
  challenges?: ChallengeName[]
}
