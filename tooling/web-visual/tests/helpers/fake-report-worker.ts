import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

/**
 * The engine's committed real reports (docs/seed-report-format.md).
 * Playwright runs specs under Node, so the path comes from `import.meta.url`.
 */
const REAL_FIXTURES = fileURLToPath(
  new URL(
    '../../../../crates/seedfinder-wasm/tests/fixtures/seed-report',
    import.meta.url
  )
)

/** A report as the fake serves it; only the seed code is read here. */
export type ReportFixture = { seed: { code: string } } & Record<string, unknown>

/** Every real fixture, keyed by its seed code (`AAA-AAA-AAA`, `2026-01-01`). */
export async function loadReportFixtures(): Promise<
  Record<string, ReportFixture>
> {
  const reports: Record<string, ReportFixture> = {}
  for (const name of (await readdir(REAL_FIXTURES)).sort()) {
    if (!name.endsWith('.json')) continue
    const text = await readFile(join(REAL_FIXTURES, name), 'utf8')
    const report = JSON.parse(text) as ReportFixture
    reports[report.seed.code] = report
  }
  return reports
}

/**
 * Replaces the app's seed-report worker with one that answers from
 * `reports` instead of running the engine. It speaks web-v2's protocol
 * (`web-v2/src/engine/report-protocol.ts`): a request
 * `{type: 'seed-report', id, request: {seed, ...}}` gets
 * `{type: 'seed-report', id, ok: true, report}`, or `ok: false` with an
 * error for a seed that has no fixture. Other workers stay real.
 */
export async function installFakeReportWorker(
  page: Page,
  reports: Record<string, ReportFixture>
): Promise<void> {
  await page.addInitScript((fixtures) => {
    const RealWorker = window.Worker

    function seedKey(seed: string): string {
      const text = seed.trim().toUpperCase()
      const letters = text.replace(/[^A-Z]/g, '')
      if (/^\d{4}-\d{2}-\d{2}$/.test(text) || letters.length !== 9) return text
      return `${letters.slice(0, 3)}-${letters.slice(3, 6)}-${letters.slice(6)}`
    }

    class FakeReportWorker extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null
      onmessageerror: ((event: MessageEvent) => void) | null = null

      constructor() {
        super()
        this.addEventListener('message', (event) =>
          this.onmessage?.(event as MessageEvent)
        )
      }

      postMessage(message: {
        type?: string
        id?: number
        request?: { seed?: string }
      }) {
        if (message?.type !== 'seed-report') return
        const report = fixtures[seedKey(message.request?.seed ?? '')]
        const data = report
          ? { type: 'seed-report', id: message.id, ok: true, report }
          : {
              type: 'seed-report',
              id: message.id,
              ok: false,
              error: `No report fixture for seed ${message.request?.seed}`,
            }
        setTimeout(() => {
          this.dispatchEvent(
            new MessageEvent('message', { data: structuredClone(data) })
          )
        }, 0)
      }

      terminate() {}
    }

    function Worker(url: string | URL, options?: WorkerOptions) {
      if (/report[.-]worker/.test(String(url))) return new FakeReportWorker()
      return new RealWorker(url, options)
    }
    Worker.prototype = RealWorker.prototype
    Object.assign(window, { Worker })
  }, reports)
}
