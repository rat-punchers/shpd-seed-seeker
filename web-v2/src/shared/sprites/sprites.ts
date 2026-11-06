import type { CSSProperties } from 'react'
import spriteBounds from '../../generated/sprite-bounds.json'

const SHEET_URL = '/third_party/shattered-pixel-dungeon/items.png'
const SHEET_COLUMNS = 16
const CELL = 16

const bounds: Record<string, number[]> = spriteBounds

// Rings all share the same gemmed base sprite and are told apart by a small
// type glyph drawn over it. The glyphs live in a separate 8×8-cell atlas.
const ICON_SHEET_URL = '/third_party/shattered-pixel-dungeon/item_icons.png'
const ICON_COLUMNS = 16
const ICON_CELL = 8

/**
 * Atlas cell of the first ring sprite (`ItemSpriteSheet.RINGS`). The twelve
 * cells from here are the twelve gems; the catalog gives every ring class the
 * cell at its own index, which doubles as the class's glyph index.
 */
export const RING_SPRITE_BASE = 224

/** Atlas cell of Arcane Resin (`ItemSpriteSheet.ARCANE_RESIN`). */
export const ARCANE_RESIN_SPRITE = 317

// Art size (w, h) of each ring glyph within its 8×8 cell, in catalog ring order.
const RING_ICON_SIZES: [number, number][] = [
  [7, 7],
  [7, 7],
  [7, 7],
  [7, 5],
  [7, 7],
  [5, 6],
  [7, 6],
  [6, 6],
  [7, 7],
  [7, 7],
  [6, 6],
  [7, 6],
]

/** The gem each ring class is drawn with in one run, in catalog ring order. */
export type RingGems = readonly number[]

/** How to draw one item: its `items.png` cell and, for a ring, its glyph. */
export interface ItemArt {
  cell: number
  ringGlyph?: number
}

/**
 * The art for a catalog sprite index. Pass a run's `ringGems` when the item
 * belongs to a seed, so a ring shows the gem that run gave its class; omit
 * them on seedless surfaces, which keep the catalog's per-class cell.
 */
export function itemArt(catalogSpriteIndex: number, gems?: RingGems): ItemArt {
  const glyph = catalogSpriteIndex - RING_SPRITE_BASE
  if (glyph < 0 || glyph >= RING_ICON_SIZES.length)
    return { cell: catalogSpriteIndex }
  const gem = gems?.[glyph]
  return {
    cell: gem === undefined ? catalogSpriteIndex : RING_SPRITE_BASE + gem,
    ringGlyph: glyph,
  }
}

/** Overlay CSS for a ring's type glyph, anchored top-right as the game draws it. */
export function ringIconCss(
  ringGlyph: number | undefined,
  size: number
): CSSProperties | undefined {
  const art = ringGlyph === undefined ? undefined : RING_ICON_SIZES[ringGlyph]
  if (ringGlyph === undefined || !art) return undefined
  const [width, height] = art
  const scale = size / CELL
  const col = ringGlyph % ICON_COLUMNS
  const row = Math.floor(ringGlyph / ICON_COLUMNS)
  return {
    position: 'absolute',
    top: 0,
    right: 0,
    width: `${width * scale}px`,
    height: `${height * scale}px`,
    backgroundImage: `url(${ICON_SHEET_URL})`,
    backgroundPosition: `${-col * ICON_CELL * scale}px ${-row * ICON_CELL * scale}px`,
    backgroundSize: `${ICON_COLUMNS * ICON_CELL * scale}px auto`,
    imageRendering: 'pixelated',
    pointerEvents: 'none',
  }
}

/**
 * The art of one cell cropped to its measured bounds and centred in a
 * size×size box, keeping the pixel scale of a full-cell render.
 */
export function spriteBoxCss(
  cell: number,
  size: number
): { outer: CSSProperties; inner: CSSProperties } {
  const [x = 0, y = 0, width = CELL, height = CELL] = bounds[String(cell)] ?? []
  const scale = size / CELL
  const col = cell % SHEET_COLUMNS
  const row = Math.floor(cell / SHEET_COLUMNS)
  return {
    outer: {
      position: 'relative',
      width: `${size}px`,
      height: `${size}px`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
    },
    inner: {
      position: 'relative',
      width: `${width * scale}px`,
      height: `${height * scale}px`,
      backgroundImage: `url(${SHEET_URL})`,
      backgroundPosition: `${-(col * CELL + x) * scale}px ${-(row * CELL + y) * scale}px`,
      backgroundSize: `${SHEET_COLUMNS * CELL * scale}px auto`,
      imageRendering: 'pixelated',
    },
  }
}

/**
 * Overlay CSS for an enchantment glow, laid over the `inner` art of
 * `spriteBoxCss` (as its child, inset 0). A color layer masked to the
 * sprite's opaque pixels pulses its opacity (the `sprite-glow` class), which
 * blends the art toward the color as the game's glow shader does; one pulse
 * lasts `2 × period` seconds.
 */
export function spriteGlowCss(
  cell: number,
  size: number,
  glow: { color: string; period: number }
): CSSProperties {
  const scale = size / CELL
  const col = cell % SHEET_COLUMNS
  const row = Math.floor(cell / SHEET_COLUMNS)
  const [x = 0, y = 0] = bounds[String(cell)] ?? []
  const maskPosition = `${-(col * CELL + x) * scale}px ${-(row * CELL + y) * scale}px`
  const maskSize = `${SHEET_COLUMNS * CELL * scale}px auto`
  return {
    position: 'absolute',
    inset: 0,
    WebkitMaskImage: `url(${SHEET_URL})`,
    maskImage: `url(${SHEET_URL})`,
    WebkitMaskPosition: maskPosition,
    maskPosition,
    WebkitMaskSize: maskSize,
    maskSize,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    pointerEvents: 'none',
    backgroundColor: glow.color,
    animationDuration: `${2 * glow.period}s`,
  }
}
