// Synthetic game screenshots for the seed reader. Shared with the browser
// tests in tooling/web-visual, which encode them as PNG files.
import { SEED_LETTER_GLYPHS } from '../../../../src/features/analyze/screenshot/seed-ocr/glyphs'

const DASH = ['######', '######']
const DASH_TOP = 7
const SPACING = 2
const BACKGROUND = 60

export interface SyntheticScreenshot {
  width: number
  height: number
  /** RGBA, row-major. */
  data: Uint8ClampedArray
}

/** Lay out text on the font-pixel grid, as the game draws it. */
function fontPixels(text: string) {
  const cells: { x: number; y: number }[] = []
  let cursor = 0
  for (const char of text) {
    if (char === ' ') {
      cursor += 12
      continue
    }
    const rows = char === '-' ? DASH : SEED_LETTER_GLYPHS[char]
    if (!rows) throw new Error(`No glyph for ${char}`)
    const top = char === '-' ? DASH_TOP : 0
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') cells.push({ x: cursor + x, y: top + y })
      }
    })
    cursor += (rows[0]?.length ?? 0) + SPACING
  }
  return { cells, width: cursor }
}

/**
 * Box-filter lines of A-Z, `-` and space text into a dark screenshot at a
 * fractional scale, the way a resized game screenshot blends the font.
 */
export function syntheticScreenshot(
  lines: string[],
  scale: number
): SyntheticScreenshot {
  const margin = 20
  const lineHeight = Math.ceil(24 * scale)
  const laid = lines.map(fontPixels)
  const width =
    Math.ceil(Math.max(...laid.map((l) => l.width)) * scale) + 2 * margin
  const height = lines.length * lineHeight + 2 * margin
  const coverage = new Float32Array(width * height)
  laid.forEach(({ cells }, line) => {
    const originY = margin + line * lineHeight
    for (const { x, y } of cells) {
      const x0 = margin + x * scale
      const y0 = originY + y * scale
      for (let py = Math.floor(y0); py < Math.ceil(y0 + scale); py++) {
        const dy = Math.min(py + 1, y0 + scale) - Math.max(py, y0)
        for (let px = Math.floor(x0); px < Math.ceil(x0 + scale); px++) {
          const dx = Math.min(px + 1, x0 + scale) - Math.max(px, x0)
          coverage[py * width + px] = (coverage[py * width + px] ?? 0) + dx * dy
        }
      }
    }
  })
  const data = new Uint8ClampedArray(width * height * 4)
  coverage.forEach((amount, i) => {
    const value = BACKGROUND + Math.min(1, amount) * (255 - BACKGROUND)
    data.set([value, value, value, 255], i * 4)
  })
  return { width, height, data }
}
