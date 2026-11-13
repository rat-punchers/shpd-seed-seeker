import type { ParsedSeed, QueryDocument } from '../../engine/types'
import { type CoordinatorState, RESULT_CAP } from './coordinator-state'
import type { SeedRange } from './traversal'

/**
 * The seed ranges a stopped search has not covered. Workers report a scanned
 * prefix length for each individual segment (never one cumulative count): a
 * segment can be abandoned mid-way when its session hits the per-session
 * result cap, and its untested tail must stay in the remainder. Reported
 * counts lag the true position slightly, which only makes the remainder
 * conservative — a resumed scan may re-test a few seeds, never skip one.
 */
export function remainingSegments(
  segments: SeedRange[][],
  workerScanned: Record<number, number[]>
): SeedRange[] {
  const remainder: SeedRange[] = []
  segments.forEach((workerSegments, workerIndex) => {
    workerSegments.forEach((segment, segmentIndex) => {
      const scanned = workerScanned[workerIndex]?.[segmentIndex] ?? 0
      if (segment.startSeed + scanned < segment.endSeedExclusive) {
        remainder.push({
          startSeed: segment.startSeed + scanned,
          endSeedExclusive: segment.endSeedExclusive,
        })
      }
    })
  })
  return remainder
}

export function segmentsLength(segments: SeedRange[]): number {
  return segments.reduce(
    (sum, segment) => sum + (segment.endSeedExclusive - segment.startSeed),
    0
  )
}

/**
 * Splits a flat list of ranges into `workerCount` contiguous slices of nearly
 * equal seed count, preserving traversal order within each slice.
 */
export function distributeSegments(
  segments: SeedRange[],
  workerCount: number
): SeedRange[][] {
  const total = segmentsLength(segments)
  const workers = Math.max(1, Math.floor(workerCount) || 1)
  const output: SeedRange[][] = Array.from({ length: workers }, () => [])
  if (total === 0) return output
  let workerIndex = 0
  let consumed = 0
  let boundary = Math.floor((total * (workerIndex + 1)) / workers)
  for (let segment of segments) {
    let length = segment.endSeedExclusive - segment.startSeed
    while (length > 0) {
      // Advance past workers whose share is already full (possible when a
      // share rounds down to zero seeds).
      while (consumed >= boundary && workerIndex < workers - 1) {
        workerIndex += 1
        boundary = Math.floor((total * (workerIndex + 1)) / workers)
      }
      const take = Math.min(length, boundary - consumed) || length
      output[workerIndex]?.push({
        startSeed: segment.startSeed,
        endSeedExclusive: segment.startSeed + take,
      })
      segment = {
        startSeed: segment.startSeed + take,
        endSeedExclusive: segment.endSeedExclusive,
      }
      consumed += take
      length -= take
    }
  }
  return output
}

/**
 * The run state a scan starts from once the filter phase kept `kept` of
 * `previousCount` pooled seeds. From here on the listed matches belong to the
 * refined query, so that is what an export must claim. A cancelled or failed
 * filter phase never reaches this, leaving the previous matches untouched.
 */
export function resumedRunState(
  query: QueryDocument,
  remainder: SeedRange[],
  kept: ParsedSeed[],
  previousCount: number
): Partial<CoordinatorState> {
  return {
    filtering: false,
    matches: kept,
    capped: kept.length >= RESULT_CAP,
    sessionBaseline: kept.length,
    queryJson: JSON.stringify(query),
    query,
    refined: { kept: kept.length, of: previousCount },
    startedAt: performance.now(),
    elapsed: 0,
    tested: 0,
    total: segmentsLength(remainder),
    rate: 0,
    rateSamples: [],
    completedWorkers: 0,
    workerScanned: {},
  }
}
