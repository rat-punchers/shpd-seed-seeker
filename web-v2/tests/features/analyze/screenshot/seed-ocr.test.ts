import { describe, expect, test } from 'bun:test'
import {
  type RgbaImage,
  recognizeSeedCodes,
} from '../../../../src/features/analyze/screenshot/seed-ocr/recognize'
import { syntheticScreenshot } from './synthetic-screenshot'

const codes = (image: RgbaImage) =>
  recognizeSeedCodes(image).map((seed) => seed.code)

describe('recognizeSeedCodes', () => {
  const seeds = ['ABC-DEF-GHI', 'JKL-MNO-PQR', 'STU-VWX-YZA', 'FVX-YTN-SLC']

  for (const scale of [2, 2.8, 3.5, 5]) {
    test(`reads every letter at ${scale}x`, () => {
      for (const seed of seeds) {
        const image = syntheticScreenshot(
          ['HEALTH', `SEED ${seed}`, 'MAXIMUM'],
          scale
        )
        expect(codes(image)).toEqual([seed])
      }
    })
  }

  test('lists every seed top to bottom without duplicates', () => {
    const image = syntheticScreenshot(
      ['RUN FVX-YTN-SLC', 'RUN ABC-DEF-GHI', 'RUN FVX-YTN-SLC'],
      3
    )
    expect(codes(image)).toEqual(['FVX-YTN-SLC', 'ABC-DEF-GHI'])
  })

  test('bounds the seed text', () => {
    const [seed] = recognizeSeedCodes(syntheticScreenshot(['ABC-DEF-GHI'], 2))
    expect(seed?.box).toEqual({ left: 20, top: 20, right: 235, bottom: 49 })
  })

  test('ignores text without the seed pattern', () => {
    const image = syntheticScreenshot(['STRENGTH', 'ABC-DEF', 'ABCDEFGHI'], 3)
    expect(codes(image)).toEqual([])
  })
})
