import { beforeAll, describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { answerReportRequest } from '../../src/engine/report-protocol'
import {
  SEED_REPORT_FORMAT,
  SEED_REPORT_SCHEMA_VERSION,
  SEED_REPORT_SECTIONS,
  type SeedReport,
} from '../../src/engine/types'
import { seedReport } from '../../src/engine/wasm'
import { loadEngine, REPO_ROOT } from './engine'

/** The engine's committed real reports (docs/seed-report-format.md). */
const FIXTURES = [
  ['AAA-AAA-AAA', 'aaa-aaa-aaa.json'],
  ['RZN-LKU-EFS', 'rzn-lku-efs.json'],
  ['2026-01-01', 'daily-2026-01-01.json'],
] as const

async function fixture(file: string): Promise<SeedReport> {
  const path = join(
    REPO_ROOT,
    'crates/seedfinder-wasm/tests/fixtures/seed-report',
    file
  )
  return JSON.parse(await readFile(path, 'utf8')) as SeedReport
}

beforeAll(loadEngine)

describe('seedReport', () => {
  for (const [seed, file] of FIXTURES) {
    it(`answers ${seed} as the committed fixture`, async () => {
      expect(await seedReport({ seed })).toEqual(await fixture(file))
    })
  }

  it('reports the schema this app reads, with known sections in order', async () => {
    const report = await seedReport({ seed: 'AAA-AAA-AAA' })
    expect(report.format).toBe(SEED_REPORT_FORMAT)
    expect(report.schemaVersion).toBe(SEED_REPORT_SCHEMA_VERSION)
    const order = report.sections.map((section) =>
      SEED_REPORT_SECTIONS.indexOf(section)
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('marks a daily seed', async () => {
    const report = await seedReport({ seed: '2026-01-01' })
    expect(report.seed).toMatchObject({ code: '2026-01-01', daily: true })
  })

  it('throws the engine message for an invalid seed', async () => {
    await expect(seedReport({ seed: 'AAA-AAA' })).rejects.toThrow()
  })
})

describe('the report worker protocol', () => {
  it('answers a request with its report', async () => {
    const answer = await answerReportRequest(
      { type: 'seed-report', id: 7, request: { seed: 'AAA-AAA-AAA' } },
      seedReport
    )
    expect(answer).toMatchObject({ type: 'seed-report', id: 7, ok: true })
  })

  it('answers an engine error with its message', async () => {
    const answer = await answerReportRequest(
      { type: 'seed-report', id: 8, request: { seed: 'nope' } },
      seedReport
    )
    expect(answer.ok).toBe(false)
    expect(answer).toMatchObject({ type: 'seed-report', id: 8 })
    if (!answer.ok) expect(answer.error.length).toBeGreaterThan(0)
  })
})
