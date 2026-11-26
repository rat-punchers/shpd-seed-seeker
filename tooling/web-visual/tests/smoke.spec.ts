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

    await expect(page).toHaveTitle('Analyze a Seed · Seed Seeker')
    const title = page.getByRole('heading', {
      level: 1,
      name: 'Seed Seeker',
      exact: true,
    })
    const subtitle = page
      .getByRole('complementary')
      .getByText('Shattered Pixel Dungeon v4.0.2', { exact: true })
    const theme = page.getByRole('button', { name: /^Theme:/ })
    await expect(title).toBeVisible()
    await expect(subtitle).toBeVisible()
    await expect(theme).toBeVisible()
    const fonts = await title.evaluate(async (node) => {
      await document.fonts.ready
      const title = getComputedStyle(node)
      const subtitle = getComputedStyle(node.nextElementSibling as Element)
      return {
        family: title.fontFamily,
        title: title.fontSize,
        subtitle: subtitle.fontSize,
      }
    })
    expect(fonts.family).toContain('SPD Pixel')
    expect(Number.parseFloat(fonts.title)).toBeGreaterThan(
      Number.parseFloat(fonts.subtitle)
    )
    const [heading, info, toggle] = await Promise.all([
      title.boundingBox(),
      subtitle.boundingBox(),
      theme.boundingBox(),
    ])
    if (!heading || !info || !toggle) throw new Error('Branding is hidden')
    expect(info.y).toBeGreaterThanOrEqual(heading.y + heading.height)
    expect(toggle.x).toBeGreaterThanOrEqual(heading.x + heading.width)
    expect(toggle.y).toBeLessThan(info.y)
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
