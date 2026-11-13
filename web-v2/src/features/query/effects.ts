import { ANY_ENCHANTMENT, type EffectFilter } from '../../engine/types'
import {
  effectNamesForCategory,
  enchantmentNamesForCategory,
} from '../../shared/game/catalog'

/** The explicit effect names a filter accepts (the shorthand expands to the family's enchantments). */
export const effectNamesOf = (
  effect: EffectFilter | undefined,
  kind: string | undefined
): string[] => {
  if (effect === undefined) return []
  if (effect === ANY_ENCHANTMENT)
    return kind ? enchantmentNamesForCategory(kind) : []
  return typeof effect === 'string' ? [effect] : effect
}

/**
 * The canonical form of an effect selection: names in catalog order, one name
 * as a bare string, the full non-curse family set as the shorthand, and an
 * empty selection as no filter. This is the writer rule every platform shares.
 */
export function canonicalEffect(
  names: readonly string[],
  kind: string | undefined
): EffectFilter | undefined {
  if (!kind)
    return names.length === 0
      ? undefined
      : names.length === 1
        ? names[0]
        : [...names]
  const order = effectNamesForCategory(kind)
  const known = order.filter((name) => names.includes(name))
  const unknown = names.filter((name) => !order.includes(name))
  const ordered = [...known, ...unknown]
  if (ordered.length === 0) return undefined
  const enchantments = enchantmentNamesForCategory(kind)
  if (
    enchantments.length > 0 &&
    ordered.length === enchantments.length &&
    enchantments.every((name) => ordered.includes(name))
  )
    return ANY_ENCHANTMENT
  return ordered.length === 1 ? ordered[0] : ordered
}
