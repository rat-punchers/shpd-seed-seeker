import type { RequirementKind } from '../../engine/types'
import {
  getItem,
  wildcardSpriteForKind,
  wildcardSprites,
} from '../game/catalog'
import type { ItemArt } from './sprites'
import { ARCANE_RESIN_SPRITE, itemArt } from './sprites'

/**
 * The art for a requirement's chip or sheet: its item, else its kind's
 * wildcard. A requirement describes what to search for, not what a run holds,
 * so a ring keeps the catalog's per-class cell whatever seed is on screen.
 */
export function requirementArt({
  item,
  kind,
}: {
  item?: string | null
  kind?: RequirementKind | null
}): ItemArt {
  if (item === 'arcane_resin') return itemArt(ARCANE_RESIN_SPRITE)
  const named = item ? getItem(item) : undefined
  if (named) return itemArt(named.sprite)
  return itemArt(kind ? wildcardSpriteForKind(kind) : wildcardSprites.weapon)
}
