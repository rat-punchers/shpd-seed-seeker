import type { EffectFilter } from '../../engine/types'
import { ANY_ENCHANTMENT } from '../../engine/types'

/**
 * Enchantment and glyph glow colors and pulse periods, mirrored from Shattered
 * Pixel Dungeon's `ItemSprite.Glowing` definitions. `period` is the seconds the
 * glow takes to fade in; it fades out over the same span, so one pulse lasts
 * `2 × period`.
 */
export interface Glow {
  /** Hex color the sprite blends toward at the pulse peak. */
  color: string
  /** Seconds to reach peak glow. */
  period: number
}

/** Upstream's default `Glowing(color)` period. */
const DEFAULT_PERIOD = 1

const glow = (color: string, period = DEFAULT_PERIOD): Glow => ({
  color,
  period,
})

// Keyed by the effect wire names. Every curse glows black (CURSE_GLOW).
const ENCHANT_GLOW: Record<string, Glow> = {
  Blazing: glow('#ff4400'),
  Chilling: glow('#00ffff'),
  Kinetic: glow('#ffff00'),
  Shocking: glow('#ffffff', 0.5),
  Venomous: glow('#4400aa'),
  Blocking: glow('#0000ff'),
  Blooming: glow('#008800'),
  Eldritch: glow('#222222'),
  Elastic: glow('#ff00ff'),
  Lucky: glow('#00ff00'),
  Projecting: glow('#8844cc'),
  Unstable: glow('#999999'),
  Vorpal: glow('#aa6666'),
  Corrupting: glow('#440066'),
  Crystal: glow('#0088ff'),
  Grim: glow('#000000'),
  Vampiric: glow('#660022'),
  Obfuscation: glow('#888888'),
  Swiftness: glow('#ffff00'),
  Viscosity: glow('#8844cc'),
  Potential: glow('#ffffff', 0.6),
  Brimstone: glow('#ff4400'),
  Stone: glow('#222222'),
  Entanglement: glow('#663300'),
  Repulsion: glow('#ffffff'),
  Camouflage: glow('#448822'),
  Flow: glow('#0000ff'),
  Affection: glow('#ff4488'),
  'Anti-Magic': glow('#88eeff'),
  Thorns: glow('#660022'),
}

const CURSE_GLOW = glow('#000000')

/** The glow of an enchantment or glyph by wire name; undefined for a curse. */
export const enchantGlow = (name: string): Glow | undefined =>
  ENCHANT_GLOW[name]

/**
 * One glow per name a requirement's effect filter accepts, in the filter's
 * order. An unknown name is a curse and glows black; the "any enchantment"
 * shorthand names no fixed set and yields nothing.
 */
export function effectGlows(effect: EffectFilter | undefined): Glow[] {
  if (!effect || effect === ANY_ENCHANTMENT) return []
  const names = typeof effect === 'string' ? [effect] : effect
  return names.map((name) => enchantGlow(name) ?? CURSE_GLOW)
}
