import { describe, expect, it } from 'bun:test'
import {
  itemArt,
  RING_SPRITE_BASE,
  typeIconCss,
} from '../../src/shared/sprites/sprites'

describe('type glyphs', () => {
  it('draws a potion or scroll glyph from the engine rectangle', () => {
    const art = itemArt(352, undefined, [0, 40, 7, 7])
    expect(art).toEqual({ cell: 352, icon: [0, 40, 7, 7] })
    const css = typeIconCss(art, 32)
    expect(css?.width).toBe('14px')
    expect(css?.height).toBe('14px')
    expect(css?.backgroundPosition).toBe('0px -80px')
  })

  it('keeps the ring glyph by class and the run gem', () => {
    const art = itemArt(RING_SPRITE_BASE + 3, [5, 6, 7, 8])
    expect(art).toEqual({ cell: RING_SPRITE_BASE + 8, ringGlyph: 3 })
    const css = typeIconCss(art, 32)
    expect(css?.backgroundPosition).toBe('-48px 0px')
    expect(css?.height).toBe('10px')
  })

  it('draws nothing without a glyph', () => {
    expect(typeIconCss(itemArt(70), 32)).toBeUndefined()
  })
})
