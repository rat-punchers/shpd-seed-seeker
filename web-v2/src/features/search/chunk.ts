/** How long one `SearchSession.advance` call should take. Short enough that a
 * stop or the first progress report lands within a frame or two, long enough
 * that the per-call overhead stays negligible. */
export const TARGET_CHUNK_MS = 40
export const FIRST_CHUNK = 8
export const MAX_CHUNK = 16_384

/**
 * The next chunk size after `tested` seeds took `elapsedMs`. Seeds cost
 * anywhere from microseconds to tens of milliseconds depending on the query,
 * so the chunk follows the measured rate, growing at most 2x per step.
 */
export function nextChunk(
  chunk: number,
  tested: number,
  elapsedMs: number
): number {
  if (tested <= 0) return chunk
  const ideal =
    elapsedMs > 0 ? (tested * TARGET_CHUNK_MS) / elapsedMs : chunk * 2
  return Math.max(1, Math.min(MAX_CHUNK, chunk * 2, Math.round(ideal)))
}
