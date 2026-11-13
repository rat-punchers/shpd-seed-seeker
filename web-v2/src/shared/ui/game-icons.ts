import iconsUrl from '@seed-seeker/design/assets/interfaces/icons.png'
import type { Sprite } from '@seed-seeker/design/lib/sprites'

/** `interfaces/icons.png`, 256×128 (v4.0.2). */
const ICONS = { url: iconsUrl, sheetWidth: 256, sheetHeight: 128 }

/** `Icons.CATALOG`: the item catalog book (`Icons.java`). */
export const CATALOG_ICON: Sprite = { ...ICONS, x: 80, y: 48, w: 13, h: 16 }

/** `Icons.STAIRS`: the descending stairs (`Icons.java`). */
export const STAIRS_ICON: Sprite = { ...ICONS, x: 0, y: 64, w: 15, h: 16 }
