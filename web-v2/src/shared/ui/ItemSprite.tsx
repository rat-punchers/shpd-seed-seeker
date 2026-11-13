import type { Glow } from '../sprites/glow'
import {
  type ItemArt,
  spriteBoxCss,
  spriteGlowCss,
  typeIconCss,
} from '../sprites/sprites'

/** One item sprite from `items.png`, with a type glyph over rings, potions and scrolls. */
export function ItemSprite({
  art,
  size = 32,
  label,
  glow,
}: {
  art: ItemArt
  /** Box size in px; a multiple of 16 keeps the pixels whole. */
  size?: number
  /** Accessible name. Omit when a visible label sits next to the sprite. */
  label?: string
  /** An enchantment glow that pulses the art, as the game draws it. */
  glow?: Glow | null
}) {
  const box = spriteBoxCss(art.cell, size)
  const typeIcon = typeIconCss(art, size)
  const content = (
    <>
      <span style={box.inner}>
        {glow ? (
          <span
            className="sprite-glow"
            style={spriteGlowCss(art.cell, size, glow)}
          />
        ) : null}
      </span>
      {typeIcon ? <span style={typeIcon} /> : null}
    </>
  )
  return label ? (
    <span role="img" aria-label={label} title={label} style={box.outer}>
      {content}
    </span>
  ) : (
    <span aria-hidden style={box.outer}>
      {content}
    </span>
  )
}
