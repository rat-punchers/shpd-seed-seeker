/**
 * Resting `ItemSprite.Glowing` colors of SHPD v4.0.2 enchantments, glyphs
 * and curses, by catalog effect name. Most curses glow black.
 */
const EFFECT_COLOR: Record<string, string> = {
  Affection: '#ff4488',
  Annoying: '#000000',
  'Anti-Entropy': '#000000',
  'Anti-Magic': '#88eeff',
  Blazing: '#ff4400',
  Blocking: '#0000ff',
  Blooming: '#008800',
  Brimstone: '#ff4400',
  Bulk: '#000000',
  Camouflage: '#448822',
  Chilling: '#00ffff',
  Corrosion: '#000000',
  Corrupting: '#440066',
  Crystal: '#0088ff',
  Dazzling: '#000000',
  Displacement: '#000000',
  Displacing: '#000000',
  Eldritch: '#222222',
  Elastic: '#ff00ff',
  Entanglement: '#663300',
  Explosive: '#000000',
  Flow: '#0000ff',
  Friendly: '#000000',
  Grim: '#000000',
  Kinetic: '#ffff00',
  Lucky: '#00ff00',
  Metabolism: '#000000',
  Multiplicity: '#000000',
  Obfuscation: '#888888',
  Overgrowth: '#000000',
  Polarized: '#000000',
  Potential: '#ffffff',
  Pressurized: '#000000',
  Projecting: '#8844cc',
  Repulsion: '#ffffff',
  Sacrificial: '#000000',
  Shocking: '#ffffff',
  Stench: '#000000',
  Stone: '#222222',
  Swiftness: '#ffff00',
  Thorns: '#660022',
  Unstable: '#999999',
  Vampiric: '#660022',
  Venomous: '#4400aa',
  Viscosity: '#8844cc',
  Vorpal: '#aa6666',
  Wayward: '#000000',
  Wondrous: '#000000',
}

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
  const glow = EFFECT_COLOR[effect.name]
  if (!glow) return null
  const lum = luminance(glow)
  if (lum < 0.18) return mix(glow, 255, 0.72)
  if (lum > 0.85) return mix(glow, 0x22, 0.45)
  return glow
}
