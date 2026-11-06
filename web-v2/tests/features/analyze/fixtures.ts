import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SeedReport } from '../../../src/engine/types'
import { REPO_ROOT } from '../../engine/engine'

/** The engine's committed real reports, by file name. */
export const REAL_FIXTURES = [
  'aaa-aaa-aaa.json',
  'rzn-lku-efs.json',
  'daily-2026-01-01.json',
] as const

export async function realReport(
  file: (typeof REAL_FIXTURES)[number]
): Promise<SeedReport> {
  const path = join(
    REPO_ROOT,
    'crates/seedfinder-wasm/tests/fixtures/seed-report',
    file
  )
  return JSON.parse(await readFile(path, 'utf8')) as SeedReport
}
