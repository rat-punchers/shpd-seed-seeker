import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import init, { seed_report } from '../../src/engine/pkg/seedfinder.js'
import type { SeedReport } from '../../src/engine/types'
import type { ReportItem } from '../../src/engine/types/report'

/**
 * Instantiates the engine module from its bytes. Once it is loaded,
 * `initEngine()` in the app's wrappers resolves without fetching.
 */
export async function loadEngine(): Promise<void> {
  await init({
    module_or_path: await readFile(
      join(import.meta.dir, '../../src/engine/pkg/seedfinder_bg.wasm')
    ),
  })
}

/** The repository root, for fixtures committed outside this package. */
export const REPO_ROOT = join(import.meta.dir, '../../..')

/**
 * The engine's seed report for a `{seed, challenges?, trinket?, query?}`
 * request, synchronously. The engine must be loaded.
 */
export const reportOf = (request: { seed: string } & Record<string, unknown>) =>
  JSON.parse(seed_report(JSON.stringify(request))) as SeedReport

/** Every item of a report, floor by floor. */
export const reportItems = (report: SeedReport): ReportItem[] =>
  report.floors.flatMap((floor) => floor.items)
