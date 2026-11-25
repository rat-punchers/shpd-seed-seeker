import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import { canvasDataUrl, waitForCanvasPaint } from './helpers/canvas'
import {
  installFakeReportWorker,
  loadReportFixtures,
} from './helpers/fake-report-worker'
import { hoverMapPoint, openMap } from './helpers/map-dialog'

const LAB = { kind: 'main', depth: 4 } as const
const ALCHEMY_PAGE = 'Torn alchemy book page'

test('lore settings regenerate the report and an already cached floor map', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  await page.goto('/?scout=AAA-AAA-AAA')
  const lore = page.getByRole('switch', { name: 'Use a fresh journal' })
  const loreHeader = page
    .getByRole('heading', { name: 'Lore pages' })
    .locator('..')
  const challenges = page.getByRole('region', { name: 'Challenges' })
  const seed = page.locator('[data-seed-title]')
  await expect(lore).not.toBeChecked()
  await expect(loreHeader).toContainText(
    'A fresh journal adds guide and alchemy pages and can shift later loot.'
  )
  expect((await seed.boundingBox())?.y).toBeLessThan(
    (await lore.boundingBox())?.y ?? 0
  )
  expect((await lore.boundingBox())?.y).toBeLessThan(
    (await challenges.boundingBox())?.y ?? 0
  )

  const floor = page.locator('[data-floor-depth="4"]')
  const pageItem = floor.getByRole('button', { name: ALCHEMY_PAGE })
  await expect(pageItem).toHaveCount(0)
  const normal = await openMap(page, LAB)
  await waitForCanvasPaint(normal.canvas)
  const snapshot = await canvasDataUrl(normal.canvas)
  await normal.dialog.getByRole('button', { name: 'Close' }).click()

  await lore.press('Space')
  await expect(lore).toBeChecked()
  await expect(pageItem).toBeVisible()
  const fresh = await openMap(page, LAB)
  await waitForCanvasPaint(fresh.canvas)
  expect(await canvasDataUrl(fresh.canvas)).not.toBe(snapshot)
  // AAA floor 4 uses width 47. The oracle places its AlchemyPage at cell 250.
  await hoverMapPoint(page, fresh.canvas, 15 * 16 + 8, 5 * 16 + 3)
  await expect(
    fresh.dialog.getByRole('dialog', { name: 'Tile details' })
  ).toContainText(ALCHEMY_PAGE)

  await page.goto('/')
  await expect(lore).toBeChecked()
  await expect(pageItem).toBeVisible()
  await lore.press('Space')
  await expect(lore).not.toBeChecked()
  await expect(pageItem).toHaveCount(0)
  expectNoBrowserErrors(errors)
})

test('a failed settings change leaves the active report usable', async ({
  page,
}) => {
  await openApp(page)
  await installFakeReportWorker(
    page,
    await loadReportFixtures(),
    'Replay unavailable'
  )
  await page.goto('/?scout=AAA-AAA-AAA')
  const lore = page.getByRole('switch', { name: 'Use a fresh journal' })
  await lore.click()
  await expect(page.getByRole('alert')).toContainText('Replay unavailable')
  await expect(lore).not.toBeChecked()
  await expect(lore).toBeEnabled()
  await expect(page.locator('[data-seed-title]')).toHaveText('AAA-AAA-AAA')
  await expect(
    page.getByRole('heading', { name: 'Floor 1', exact: true })
  ).toBeVisible()
})

test.describe('touch layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('challenge controls fit and respond to a tap', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await openApp(page)
    await page.goto('/?scout=AAA-AAA-AAA')
    const region = page.getByRole('region', { name: 'Challenges' })
    const darkness = region.getByRole('button', { name: 'Into Darkness' })
    const torch = page
      .locator('[data-floor-depth="1"]')
      .getByRole('button', { name: 'Torch' })
    await expect(region.getByRole('button')).toHaveCount(4)
    await expect(
      region.getByRole('heading', { name: 'Challenges' }).locator('..')
    ).toContainText('Only challenges that affect floor generation are shown.')
    await expect(region).toContainText(
      'Halves the number of Scrolls of Upgrade that spawn.'
    )
    await expect(region).not.toContainText('Hostile Champions')
    expect(
      await region.evaluate((node) => node.scrollWidth <= node.clientWidth)
    ).toBe(true)
    await expect(torch).toHaveCount(0)
    await darkness.tap()
    await expect(darkness).toHaveAttribute('aria-pressed', 'true')
    await expect(torch).toBeVisible()
    await page.goto('/')
    await expect(darkness).toHaveAttribute('aria-pressed', 'true')
    await expect(torch).toBeVisible()
    expectNoBrowserErrors(errors)
  })
})
