import {
  type ArcaneResinFilter,
  type EffectFilter,
  type QueryDocument,
  type QueryState,
  type RequirementDocument,
  type RequirementEntryDocument,
  type RequirementRow,
  type RequirementState,
  type TierFilter,
  type UpgradeFilter,
  WANDMAKER_QUESTS,
  type WandmakerQuest,
} from '../../engine/types'
import { getItem } from '../../shared/game/catalog'
import { floorsFromDocument } from '../../shared/game/floor-requirements'
import { canonicalEffect } from './effects'
import {
  defaultTier,
  defaultUpgrade,
  MAX_DEPTH,
  normalizeFloorLimit,
  TRINKET_TRANSMUTATION_MAX,
} from './limits'
import {
  validArcaneResin,
  validateArcaneResinFilter,
  withoutDefaultFilter,
} from './resin'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Decodes the wire tier forms: absent, "any", or a single-key filter object. */
function tierFromDocument(value: unknown): TierFilter {
  if (value === undefined) return defaultTier()
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'any') return defaultTier()
    throw new Error(`unknown tier mode "${value}"`)
  }
  if (isRecord(value) && Object.keys(value).length === 1) {
    if (typeof value.exact === 'number')
      return { mode: 'exact', value: value.exact }
    if (typeof value.at_least === 'number')
      return { mode: 'at_least', value: value.at_least }
    if (typeof value.at_most === 'number')
      return { mode: 'at_most', value: value.at_most }
  }
  throw new Error('unrecognized tier filter')
}

/** Decodes the wire upgrade forms: absent, "any", a number, or a single-key filter object. */
function upgradeFromDocument(value: unknown): UpgradeFilter {
  if (value === undefined) return defaultUpgrade()
  if (typeof value === 'number') return { mode: 'exact', value }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'any') return defaultUpgrade()
    throw new Error(`unknown upgrade mode "${value}"`)
  }
  if (isRecord(value) && Object.keys(value).length === 1) {
    if (typeof value.exact === 'number')
      return { mode: 'exact', value: value.exact }
    if (typeof value.at_least === 'number')
      return { mode: 'at_least', value: value.at_least }
  }
  throw new Error('unrecognized upgrade filter')
}

/** Rejects unknown quest names rather than silently widening the filter. */
function wandmakerQuestFromDocument(
  value: unknown
): WandmakerQuest | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    if ((WANDMAKER_QUESTS as readonly string[]).includes(value))
      return value as WandmakerQuest
    throw new Error(`unknown Wandmaker quest "${value}"`)
  }
  throw new Error('unrecognized Wandmaker quest filter')
}

/** Decodes the wire effect forms: absent, a bare name, or a list of names; anything else is an error. */
function effectFromDocument(
  value: unknown,
  kind: string | undefined
): EffectFilter | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every((name) => typeof name === 'string')) {
    // Lists are stored canonically so a round trip is the identity.
    return canonicalEffect(value as string[], kind)
  }
  throw new Error('unrecognized effect filter')
}

function levelSumFromDocument(value: unknown): RequirementState['levelSum'] {
  if (value === undefined || value === null) return undefined
  if (
    isRecord(value) &&
    typeof value.group === 'number' &&
    typeof value.at_least === 'number'
  ) {
    return { group: value.group, atLeast: value.at_least }
  }
  throw new Error('unrecognized level_sum')
}

/** A whole-number count from 0 to `max`, or why not. */
function transmutations(value: unknown, name: string, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  )
    throw new Error(`${name} must be an integer from 0 to ${max}`)
  return value
}

function requireBoolean(raw: Record<string, unknown>, name: string) {
  if (raw[name] !== undefined && typeof raw[name] !== 'boolean')
    throw new Error(`${name} must be a boolean`)
}

function requirementFromDocument(
  value: RequirementDocument,
  key: number,
  alternativeGroup?: number
): RequirementState {
  const raw = value as Record<string, unknown>
  // Same rule as the encoder: an item-only requirement gets its item's
  // category, so the state a share link or a results file restores carries
  // the kind the start decision needs.
  const kind =
    value.kind ?? (value.item ? getItem(value.item)?.type : undefined)
  const requirement: RequirementState = {
    key,
    kind,
    item: value.item,
    tier: tierFromDocument(raw.tier),
    upgrade: upgradeFromDocument(raw.upgrade),
    effect: effectFromDocument(raw.effect, kind),
    uncursed: value.uncursed ?? false,
    source: value.source,
    identityGroup: value.identity_group,
    maxDepth:
      value.max_depth === undefined
        ? undefined
        : normalizeFloorLimit(value.max_depth),
  }
  requireBoolean(raw, 'select_trinket')
  requireBoolean(raw, 'blanket')
  if (value.blanket) requirement.blanket = true
  requireBoolean(raw, 'exclude_resin')
  if (value.exclude_resin) requirement.excludeResin = true
  if (value.select_trinket) requirement.selectTrinket = true
  if (raw.trinket_transmutations !== undefined) {
    const count = transmutations(
      raw.trinket_transmutations,
      'trinket_transmutations',
      TRINKET_TRANSMUTATION_MAX
    )
    if (count > 0) requirement.trinketTransmutations = count
  }
  if (raw.artifact_transmutations !== undefined) {
    const count = transmutations(
      raw.artifact_transmutations,
      'artifact_transmutations',
      10
    )
    if (count > 0) requirement.artifactTransmutations = count
  }
  if (alternativeGroup !== undefined)
    requirement.alternativeGroup = alternativeGroup
  // The unreleased upgrade_sum key is refused rather than reinterpreted.
  if (raw.upgrade_sum !== undefined)
    throw new Error('upgrade_sum is no longer supported; use level_sum')
  const levelSum = levelSumFromDocument(raw.level_sum)
  if (levelSum) requirement.levelSum = levelSum
  return requirement
}

/**
 * Flattens the entries: any_of groups get fresh sequential group ids in
 * document order, and the rows are keyed 1…n for the requirement editor.
 */
function requirementsFromDocument(
  entries: RequirementEntryDocument[]
): RequirementState[] {
  const requirements: RequirementState[] = []
  let nextGroup = 0
  for (const entry of entries) {
    if (isRecord(entry) && 'any_of' in entry) {
      const members = (entry as { any_of: unknown }).any_of
      if (!Array.isArray(members) || members.length === 0)
        throw new Error('any_of needs at least one alternative')
      nextGroup += 1
      for (const member of members) {
        if (!isRecord(member) || 'any_of' in member)
          throw new Error('any_of groups cannot nest')
        requirements.push(
          requirementFromDocument(
            member as RequirementDocument,
            requirements.length + 1,
            nextGroup
          )
        )
      }
      continue
    }
    requirements.push(
      requirementFromDocument(
        entry as RequirementDocument,
        requirements.length + 1
      )
    )
  }
  return requirements
}

/** Reads a row the requirement editor answered with back into editor state. */
export function requirementFromRow(row: RequirementRow): RequirementState {
  return requirementFromDocument(row, row.key, row.alternative_group)
}

function resinFilterFromDocument(
  filter: unknown
): ArcaneResinFilter | undefined {
  if (
    !isRecord(filter) ||
    (filter.uncursed !== undefined && typeof filter.uncursed !== 'boolean') ||
    (filter.include_mage_wand !== undefined &&
      typeof filter.include_mage_wand !== 'boolean')
  )
    throw new Error('Invalid Arcane Resin filters.')
  const parsed = {
    uncursed: (filter.uncursed as boolean | undefined) ?? true,
    ...(filter.include_mage_wand ? { includeMageWand: true } : {}),
    ...(filter.max_depth !== undefined
      ? { maxDepth: filter.max_depth as number }
      : {}),
    ...(filter.source !== undefined
      ? { source: filter.source as ArcaneResinFilter['source'] }
      : {}),
  }
  const errors = validateArcaneResinFilter(parsed)
  if (errors.length) throw new Error(errors[0])
  return withoutDefaultFilter(parsed)
}

/**
 * Decodes a stored query document. Keys this release no longer writes are
 * ignored rather than rejected, matching the engine's codec: a saved query, a
 * preset or a share link written before fast mode was removed still loads, and
 * its `fast_mode` flag simply has no effect.
 */
export function fromQueryJson(json: string): QueryState {
  const document = JSON.parse(json) as QueryDocument
  if (!isRecord(document) || !Array.isArray(document.requirements))
    throw new Error('a query needs a requirements list')
  if (document.challenges !== undefined && !Array.isArray(document.challenges))
    throw new Error('challenges must be a list of challenge names')
  if (
    document.auto_apply_trinket !== undefined &&
    typeof document.auto_apply_trinket !== 'boolean'
  )
    throw new Error('auto_apply_trinket must be a boolean')
  if (
    document.arcane_resin !== undefined &&
    !validArcaneResin(document.arcane_resin)
  )
    throw new Error(
      'Arcane Resin must be Auto or a whole number from 0 through 65535.'
    )
  const arcaneResinFilter =
    document.arcane_resin_filter === undefined
      ? undefined
      : resinFilterFromDocument(document.arcane_resin_filter)
  return {
    ...(document.arcane_resin ? { arcaneResin: document.arcane_resin } : {}),
    ...(arcaneResinFilter ? { arcaneResinFilter } : {}),
    autoApplyTrinket: document.auto_apply_trinket ?? false,
    requirements: requirementsFromDocument(document.requirements),
    ...(document.floor_requirements !== undefined
      ? { floorRequirements: floorsFromDocument(document.floor_requirements) }
      : {}),
    maxDepth: normalizeFloorLimit(document.max_depth ?? MAX_DEPTH),
    requireBlacksmith: document.require_blacksmith ?? false,
    excludeBlacksmithRewards: document.exclude_blacksmith_rewards ?? false,
    wandmakerQuest: wandmakerQuestFromDocument(document.wandmaker_quest),
    challenges: document.challenges ? [...document.challenges] : [],
  }
}
