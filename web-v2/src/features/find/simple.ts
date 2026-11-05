import type {
  QueryState,
  RequirementKind,
  RequirementState,
} from '../../engine/types'
import { getItem } from '../../shared/game/catalog'
import {
  defaultQueryState,
  defaultTier,
  defaultUpgrade,
  querySlots,
} from '../query/query'

/**
 * One row of Find's Simple view: an item kind, optionally one item, a minimum
 * upgrade and a floor limit of its own. Absent fields mean "any".
 */
export interface SimpleConstraint {
  /** The requirement's key, kept so a row keeps its identity across views. */
  key: number
  kind: RequirementKind
  item?: string
  minUpgrade?: number
  maxDepth?: number
}

/** Whether a seed must hold every row, or any one of them. */
export type MatchMode = 'all' | 'any'

/** The query as the Simple view shows it. */
export interface SimpleQuery {
  matchMode: MatchMode
  /** The query's floor limit. */
  maxDepth: number
  constraints: SimpleConstraint[]
}

/** The kind a requirement filters on, derived from its item when it names none. */
const kindOf = (requirement: RequirementState): RequirementKind | undefined =>
  requirement.kind ??
  (requirement.item ? getItem(requirement.item)?.type : undefined)

/** Whether a row carries only what a Simple row shows. */
function isSimpleRequirement(requirement: RequirementState): boolean {
  return (
    kindOf(requirement) !== undefined &&
    requirement.tier.mode === 'any' &&
    requirement.upgrade.mode !== 'exact' &&
    requirement.effect === undefined &&
    !requirement.uncursed &&
    requirement.source === undefined &&
    !requirement.identityGroup &&
    !requirement.blanket &&
    !requirement.excludeResin &&
    !requirement.selectTrinket &&
    !requirement.trinketTransmutations &&
    !requirement.artifactTransmutations &&
    requirement.levelSum === undefined
  )
}

/**
 * Whether the Simple view can show the whole query. Anything it has no
 * control for (effects, tiers, exact upgrades, blankets, resin, floor
 * requirements, quests, Blacksmith options, challenges, trinket selection,
 * transmutations, level sums, AutoTrinket turned off) makes it an Advanced
 * query. The rows must be all separate ("Match all") or one "any of" group
 * holding every row ("Match any").
 */
export function isSimpleRepresentable(query: QueryState): boolean {
  if (
    query.floorRequirements?.length ||
    query.arcaneResin ||
    query.arcaneResinFilter ||
    !query.autoApplyTrinket ||
    query.requireBlacksmith ||
    query.excludeBlacksmithRewards ||
    query.wandmakerQuest ||
    query.challenges.length
  )
    return false
  if (!query.requirements.every(isSimpleRequirement)) return false
  const slots = querySlots(query.requirements)
  return slots.length <= 1 || slots.every((slot) => slot.members.length === 1)
}

/**
 * The query as the Simple view shows it, or `null` when it holds something
 * Simple cannot show. One row reads as "Match all": with a single row the two
 * modes mean the same.
 */
export function toSimple(query: QueryState): SimpleQuery | null {
  if (!isSimpleRepresentable(query)) return null
  const grouped =
    query.requirements.length > 1 && querySlots(query.requirements).length === 1
  return {
    matchMode: grouped ? 'any' : 'all',
    maxDepth: query.maxDepth,
    constraints: query.requirements.map((requirement) => ({
      key: requirement.key,
      kind: kindOf(requirement) as RequirementKind,
      ...(requirement.item ? { item: requirement.item } : {}),
      ...(requirement.upgrade.mode === 'at_least'
        ? { minUpgrade: requirement.upgrade.value }
        : {}),
      ...(requirement.maxDepth !== undefined
        ? { maxDepth: requirement.maxDepth }
        : {}),
    })),
  }
}

/**
 * The query a Simple view describes. "Match any" puts every row in one
 * "any of" group; a single row stays a plain requirement, which is how the
 * requirement editor writes a group of one.
 */
export function fromSimple(simple: SimpleQuery): QueryState {
  const grouped = simple.matchMode === 'any' && simple.constraints.length > 1
  return {
    ...defaultQueryState(),
    maxDepth: simple.maxDepth,
    requirements: simple.constraints.map((constraint) => ({
      key: constraint.key,
      kind: constraint.kind,
      ...(constraint.item ? { item: constraint.item } : {}),
      tier: defaultTier(),
      upgrade:
        constraint.minUpgrade === undefined
          ? defaultUpgrade()
          : { mode: 'at_least', value: constraint.minUpgrade },
      uncursed: false,
      ...(constraint.maxDepth !== undefined
        ? { maxDepth: constraint.maxDepth }
        : {}),
      ...(grouped ? { alternativeGroup: 1 } : {}),
    })),
  }
}
