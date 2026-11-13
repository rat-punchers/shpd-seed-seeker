import type {
  QueryDocument,
  QueryState,
  RequirementDocument,
  RequirementEntryDocument,
  RequirementRow,
  RequirementState,
} from '../../engine/types'
import { getItem } from '../../shared/game/catalog'
import { canonicalEffect, effectNamesOf } from './effects'
import { MAX_DEPTH } from './limits'

/** One "any of these" slot: the indices of its members in requirement order. */
export interface QuerySlot {
  key: string
  members: number[]
}

/**
 * Groups requirements into slots: an alternative group is one slot at its
 * first member's position; every other requirement is a slot of its own.
 */
export function querySlots(
  requirements: readonly RequirementState[]
): QuerySlot[] {
  const slots: QuerySlot[] = []
  const byGroup = new Map<number, QuerySlot>()
  requirements.forEach((requirement, index) => {
    const group = requirement.alternativeGroup
    if (group !== undefined) {
      const existing = byGroup.get(group)
      if (existing) {
        existing.members.push(index)
        return
      }
      const slot = { key: `alt:${group}`, members: [index] }
      byGroup.set(group, slot)
      slots.push(slot)
      return
    }
    slots.push({ key: `req:${index}`, members: [index] })
  })
  return slots
}

/** The requirement as one entry of a query document, without its key or either/or label. */
export function requirementToDocument(
  requirement: RequirementState
): RequirementDocument {
  const output: RequirementDocument = {}
  // The category is always written, derived from the item when the editor
  // state has none: the engine's start decision compares kinds for equality,
  // so a requirement that omits its kind would share with nothing.
  const kind =
    requirement.kind ??
    (requirement.item ? getItem(requirement.item)?.type : undefined)
  if (kind) output.kind = kind
  if (requirement.item) output.item = requirement.item
  if (requirement.tier.mode !== 'any') {
    output.tier = {
      [requirement.tier.mode]: requirement.tier.value,
    } as NonNullable<RequirementDocument['tier']>
  }
  if (requirement.upgrade.mode === 'exact')
    output.upgrade = requirement.upgrade.value
  if (requirement.upgrade.mode === 'at_least')
    output.upgrade = { at_least: requirement.upgrade.value }
  if (requirement.effect !== undefined) {
    const effect = canonicalEffect(
      effectNamesOf(requirement.effect, kind),
      kind
    )
    if (effect !== undefined) output.effect = effect
  }
  if (requirement.uncursed) output.uncursed = true
  if (requirement.blanket) output.blanket = true
  if (requirement.excludeResin) output.exclude_resin = true
  if (requirement.selectTrinket) output.select_trinket = true
  if (requirement.trinketTransmutations)
    output.trinket_transmutations = requirement.trinketTransmutations
  if (requirement.artifactTransmutations)
    output.artifact_transmutations = requirement.artifactTransmutations
  if (requirement.source) output.source = requirement.source
  if (requirement.identityGroup)
    output.identity_group = requirement.identityGroup
  if (requirement.maxDepth !== undefined)
    output.max_depth = requirement.maxDepth
  if (requirement.levelSum)
    output.level_sum = {
      group: requirement.levelSum.group,
      at_least: requirement.levelSum.atLeast,
    }
  return output
}

export function toQueryDocument(state: QueryState): QueryDocument {
  // An alternative group is one any_of entry at its first member's position;
  // a group of one is a plain requirement.
  const entries: RequirementEntryDocument[] = querySlots(
    state.requirements
  ).map((slot) => {
    const members = slot.members.flatMap((index) => {
      const requirement = state.requirements[index]
      return requirement ? [requirementToDocument(requirement)] : []
    })
    const [only] = members
    return members.length === 1 && only ? only : { any_of: members }
  })
  const output: QueryDocument = { requirements: entries }
  if (state.floorRequirements?.length)
    output.floor_requirements = state.floorRequirements
  if (state.arcaneResin !== undefined && state.arcaneResin !== 0)
    output.arcane_resin = state.arcaneResin
  const resinFilter = state.arcaneResinFilter
  if (
    resinFilter &&
    (!resinFilter.uncursed ||
      resinFilter.maxDepth !== undefined ||
      resinFilter.source ||
      resinFilter.includeMageWand)
  ) {
    output.arcane_resin_filter = {
      ...(!resinFilter.uncursed ? { uncursed: false } : {}),
      ...(resinFilter.includeMageWand ? { include_mage_wand: true } : {}),
      ...(resinFilter.maxDepth !== undefined
        ? { max_depth: resinFilter.maxDepth }
        : {}),
      ...(resinFilter.source ? { source: resinFilter.source } : {}),
    }
  }
  if (state.autoApplyTrinket) output.auto_apply_trinket = true
  if (state.maxDepth !== MAX_DEPTH) output.max_depth = state.maxDepth
  if (state.requireBlacksmith) output.require_blacksmith = true
  if (state.excludeBlacksmithRewards) output.exclude_blacksmith_rewards = true
  if (state.wandmakerQuest) output.wandmaker_quest = state.wandmakerQuest
  if (state.challenges.length) output.challenges = [...state.challenges]
  return output
}

export function toQueryJson(state: QueryState): string {
  return JSON.stringify(toQueryDocument(state))
}

/** The requirement as a row of the requirement editor: its document entry, key and either/or label. */
export function requirementToRow(
  requirement: RequirementState
): RequirementRow {
  return {
    ...requirementToDocument(requirement),
    key: requirement.key,
    ...(requirement.alternativeGroup !== undefined
      ? { alternative_group: requirement.alternativeGroup }
      : {}),
  }
}
