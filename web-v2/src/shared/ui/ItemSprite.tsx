import { type ItemArt, ringIconCss, spriteBoxCss } from '../sprites/sprites'

/** One item sprite from `items.png`, with a ring's type glyph over it. */
export function ItemSprite({
  art,
  size = 32,
  label,
}: {
  art: ItemArt
  /** Box size in px; a multiple of 16 keeps the pixels whole. */
  size?: number
  /** Accessible name. Omit when a visible label sits next to the sprite. */
  label?: string
}) {
  const box = spriteBoxCss(art.cell, size)
  const ringIcon = ringIconCss(art.ringGlyph, size)
  const content = (
    <>
      <span style={box.inner} />
      {ringIcon ? <span style={ringIcon} /> : null}
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
