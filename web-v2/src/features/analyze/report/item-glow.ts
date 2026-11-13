import { enchantGlow } from '../../../shared/sprites/glow'

// Report slot frames and title colors, derived from the SHPD effect glows in
// `shared/sprites/glow.ts`. Curses take the red curse color instead.

/** The red frame of cursed gear. */
export const CURSE_BORDER = '#d64545'

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(index, index + 2), 16)
}

function mix(hex: string, toward: number, amount: number): string {
  const mixed = [1, 3, 5].map((index) => {
    const value = channel(hex, index)
    return Math.round(value + (toward - value) * amount)
      .toString(16)
      .padStart(2, '0')
  })
  return `#${mixed.join('')}`
}

function luminance(hex: string): number {
  return (
    (0.2126 * channel(hex, 1) +
      0.7152 * channel(hex, 3) +
      0.0722 * channel(hex, 5)) /
    255
  )
}

/**
 * A slot frame for an effect: red for curses, else the glow, lifted or
 * darkened when it would not read on the slot.
 */
export function effectBorderColor(
  effect: { name: string; kind: 'enchantment' | 'curse' } | null | undefined
): string | null {
  if (!effect) return null
  if (effect.kind === 'curse') return CURSE_BORDER
  const glow = enchantGlow(effect.name)?.color
  if (!glow) return null
  const lum = luminance(glow)
  if (lum < 0.18) return mix(glow, 255, 0.72)
  if (lum > 0.85) return mix(glow, 0x22, 0.45)
  return glow
}

/**
 * Title text for an effect: red for curses, else the glow's hue at a
 * lightness each theme can read (`--effect-text-l`). Black, white and grey
 * glows carry no hue, so they read in the info color.
 */
export function effectTextColor(
  effect: { name: string; kind: 'enchantment' | 'curse' } | null | undefined
): string | null {
  if (!effect) return null
  if (effect.kind === 'curse') return 'var(--color-destructive)'
  const glow = enchantGlow(effect.name)?.color
  if (!glow) return null
  const channels = [1, 3, 5].map((index) => channel(glow, index))
  if (Math.max(...channels) - Math.min(...channels) < 48) {
    return 'var(--color-info)'
  }
  return `oklch(from ${glow} var(--effect-text-l) clamp(0.1, c, 0.17) h)`
}
