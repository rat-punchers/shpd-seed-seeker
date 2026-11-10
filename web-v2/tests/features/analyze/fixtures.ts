import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SeedReport } from '../../../src/engine/types'
import { seedReport } from '../../../src/engine/wasm'
import { loadEngine, REPO_ROOT } from '../../engine/engine'

/** The engine's committed real reports, by file name. */
const REAL_FIXTURES = ['aaa-aaa-aaa.json'] as const

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

type NamedReport = [name: string, load: () => Promise<SeedReport>]

/** Real reports by name: each committed fixture, and a live daily report. */
export const REAL_REPORTS: readonly NamedReport[] = [
  ...REAL_FIXTURES.map((file): NamedReport => [file, () => realReport(file)]),
  [
    'the 2026-01-01 daily',
    async () => {
      await loadEngine()
      return seedReport({ seed: '2026-01-01' })
    },
  ],
]
