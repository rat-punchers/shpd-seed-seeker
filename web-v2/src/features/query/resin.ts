import type {
  ArcaneResinFilter,
  QueryState,
  ResinCondition,
} from '../../engine/types'
import { sources } from '../../shared/game/catalog'
import { MAX_DEPTH } from './limits'

/** A resin donor filter, or none when it asks for nothing beyond uncursed donors. */
export const withoutDefaultFilter = (
  filter: ArcaneResinFilter
): ArcaneResinFilter | undefined =>
  !filter.uncursed ||
  filter.maxDepth !== undefined ||
  filter.source ||
  filter.includeMageWand
    ? filter
    : undefined

/** The query's Arcane Resin condition as the requirement editor reads it, or `null` without one. */
export function resinCondition(
  query: Pick<QueryState, 'arcaneResin' | 'arcaneResinFilter'>
): ResinCondition | null {
  const amount = query.arcaneResin
  if (!amount || !validArcaneResin(amount)) return null
  const filter = query.arcaneResinFilter
  return {
    amount,
    filter: filter
      ? {
          uncursed: filter.uncursed,
          max_depth: filter.maxDepth ?? null,
          source: filter.source ?? null,
          include_mage_wand: filter.includeMageWand ?? false,
        }
      : null,
  }
}

/** Reads a resin condition the requirement editor answered with back into query state. */
export function resinFromCondition({
  amount,
  filter,
}: ResinCondition): Pick<QueryState, 'arcaneResin' | 'arcaneResinFilter'> {
  return {
    arcaneResin: amount,
    arcaneResinFilter: withoutDefaultFilter({
      uncursed: filter?.uncursed ?? true,
      ...(filter?.include_mage_wand ? { includeMageWand: true } : {}),
      ...(filter?.max_depth != null ? { maxDepth: filter.max_depth } : {}),
      ...(filter?.source ? { source: filter.source } : {}),
    }),
  }
}

/** Whether an Arcane Resin amount is Auto or a whole number of resin. */
export function validArcaneResin(value: unknown): boolean {
  return (
    value === 'auto' ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 65535)
  )
}

/** What is wrong with the Arcane Resin donor filter. */
export function validateArcaneResinFilter(filter: ArcaneResinFilter): string[] {
  const errors: string[] = []
  if (typeof filter.uncursed !== 'boolean')
    errors.push('Invalid Arcane Resin uncursed filter.')
  if (
    filter.includeMageWand !== undefined &&
    typeof filter.includeMageWand !== 'boolean'
  )
    errors.push('Invalid starting wand option.')
  if (
    filter.maxDepth !== undefined &&
    (!Number.isInteger(filter.maxDepth) ||
      filter.maxDepth < 1 ||
      filter.maxDepth > MAX_DEPTH)
  )
    errors.push(`Arcane Resin floor must be 1 through ${MAX_DEPTH}.`)
  if (
    filter.source !== undefined &&
    !sources.some((source) => source.value === filter.source)
  )
    errors.push('Invalid Arcane Resin source.')
  return errors
}
