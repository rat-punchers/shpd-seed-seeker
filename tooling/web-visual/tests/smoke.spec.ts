import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import {
  installFakeReportWorker,
  loadReportFixtures,
} from './helpers/fake-report-worker'

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'phone', width: 390, height: 844 },
] as const

for (const viewport of VIEWPORTS) {
  test(`shell renders at ${viewport.width}px without errors`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const errors = collectBrowserErrors(page)
    await openApp(page)

    await expect(page).toHaveTitle('Seed Seeker')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seed Seeker · SHPD v4.0.2' })
    ).toBeVisible()
    // Nothing spills past the viewport sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
    expectNoBrowserErrors(errors)
  })
}

test('the fake report worker answers from the committed fixtures', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await installFakeReportWorker(page, await loadReportFixtures())
  await openApp(page)

  const answers = await page.evaluate(async () => {
    const worker = new Worker('/assets/report.worker.js', { type: 'module' })
    const ask = (id: number, seed: string) =>
      new Promise<{ id: number; ok: boolean; code?: string; error?: string }>(
        (resolve) => {
          const listener = (event: MessageEvent) => {
            if (event.data.id !== id) return
            worker.removeEventListener('message', listener)
            resolve({
              id,
              ok: event.data.ok,
              code: event.data.report?.seed.code,
              error: event.data.error,
            })
          }
          worker.addEventListener('message', listener)
          worker.postMessage({ type: 'seed-report', id, request: { seed } })
        }
      )
    return Promise.all([ask(1, 'aaaaaaaaa'), ask(2, 'ZZZ-ZZZ-ZZZ')])
  })

  expect(answers[0]).toEqual({ id: 1, ok: true, code: 'AAA-AAA-AAA' })
  expect(answers[1]).toMatchObject({ id: 2, ok: false })
  expectNoBrowserErrors(errors)
})
