import iconsUrl from '@seed-seeker/design/assets/interfaces/icons.png'
import type { Sprite } from '@seed-seeker/design/lib/sprites'
import type { FloorFeeling } from '../../engine/types'

/** `interfaces/icons.png`, 256×128 (v4.0.2). */
const ICONS = { url: iconsUrl, sheetWidth: 256, sheetHeight: 128 }

/** `Icons.CATALOG`: the item catalog book (`Icons.java`). */
export const CATALOG_ICON: Sprite = { ...ICONS, x: 80, y: 48, w: 13, h: 16 }

/** `Icons.CHALLENGE_GREY` and `Icons.CHALLENGE_COLOR`. */
export const CHALLENGE_ICON: Sprite = { ...ICONS, x: 144, y: 16, w: 15, h: 12 }
export const CHALLENGE_ON_ICON: Sprite = { ...CHALLENGE_ICON, y: 32 }

/** `Icons.STAIRS`: the descending stairs (`Icons.java`). */
export const STAIRS_ICON: Sprite = { ...ICONS, x: 0, y: 64, w: 15, h: 16 }

/** The game's large floor-feeling icons, in order along the stairs row. */
const FEELING_FRAMES: Record<Exclude<FloorFeeling, 'none'>, number> = {
  chasm: 1,
  water: 2,
  grass: 3,
  dark: 4,
  large: 5,
  traps: 6,
  secrets: 7,
}

export function floorFeelingIcon(feeling: FloorFeeling | undefined) {
  if (!feeling || feeling === 'none') return undefined
  return { ...STAIRS_ICON, x: 16 * FEELING_FRAMES[feeling] }
}
