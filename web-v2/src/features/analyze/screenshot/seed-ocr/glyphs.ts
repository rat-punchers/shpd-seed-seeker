import { GLYPHS_A_TO_M } from './glyphs-a-m'
import { GLYPHS_N_TO_Z } from './glyphs-n-z'

/**
 * Seed-code glyphs from the game's `assets/fonts/pixel_font.ttf`, rasterized
 * on the font's 100-unit pixel grid and trimmed to ink. `#` is ink.
 */
export const SEED_LETTER_GLYPHS: Record<string, readonly string[]> = {
  ...GLYPHS_A_TO_M,
  ...GLYPHS_N_TO_Z,
}
