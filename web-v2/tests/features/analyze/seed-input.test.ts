import { beforeAll, describe, expect, it } from 'bun:test'
import { formatSeedCode } from '../../../src/engine/wasm'
import {
  caretAfterSignificant,
  isCompleteSeedInput,
  significantCountBefore,
} from '../../../src/features/analyze/seed-input'
import { loadEngine } from '../../engine/engine'

beforeAll(loadEngine)

describe('the seed field', () => {
  it('accepts only whole seed codes and daily dates', () => {
    expect(isCompleteSeedInput('ABC-DEF-GHI')).toBe(true)
    expect(isCompleteSeedInput('2026-01-01')).toBe(true)
    expect(isCompleteSeedInput('ABC-DEF')).toBe(false)
    expect(isCompleteSeedInput('2026-01')).toBe(false)
    expect(isCompleteSeedInput('abc-def-ghi')).toBe(false)
  })

  it('keeps the caret after the same letter once the engine regroups the text', () => {
    // Typing the fourth letter of "abcd": the engine inserts a dash first.
    const raw = 'abcd'
    const formatted = formatSeedCode(raw)
    expect(formatted).toBe('ABC-D')
    expect(
      caretAfterSignificant(formatted, significantCountBefore(raw, 4))
    ).toBe(5)
    // Editing in the middle: the caret stays after the third letter.
    expect(
      caretAfterSignificant('ABC-DEF', significantCountBefore('ABxC-DEF', 3))
    ).toBe(3)
  })

  it('counts digits for a daily date', () => {
    const raw = '202601'
    expect(formatSeedCode(raw)).toBe('2026-01')
    expect(
      caretAfterSignificant('2026-01', significantCountBefore(raw, 5))
    ).toBe(6)
  })
})
