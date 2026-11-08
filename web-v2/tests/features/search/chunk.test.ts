import { expect, it } from 'bun:test'
import {
  MAX_CHUNK,
  nextChunk,
  TARGET_CHUNK_MS,
} from '../../../src/features/search/chunk'

it('sizes the next chunk to the target time, growing at most twofold', () => {
  // 8 seeds in 80ms: 10ms each, so 4 fit the target.
  expect(nextChunk(8, 8, 80)).toBe(4)
  // Cheap seeds double the chunk rather than jumping to the estimate.
  expect(nextChunk(8, 8, 0.1)).toBe(16)
  expect(nextChunk(MAX_CHUNK, MAX_CHUNK, 1)).toBe(MAX_CHUNK)
  // A very slow seed still advances one at a time.
  expect(nextChunk(1, 1, TARGET_CHUNK_MS * 50)).toBe(1)
})

it('keeps the chunk when nothing was tested', () => {
  expect(nextChunk(32, 0, 5)).toBe(32)
})
