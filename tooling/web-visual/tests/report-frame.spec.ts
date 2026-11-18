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

test('the report frames the seed like the game and opening an item keeps the scroll', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page)
  const field = page.getByLabel('Enter your seed')
  await field.pressSequentially('aaaaaaaaa')
  await expect(field).toHaveValue('AAA-AAA-AAA')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()

  const title = page.locator('[data-seed-title]')
  await expect(title).toHaveText('AAA-AAA-AAA')
  await expect(
    page.locator('[data-slot="game-window"] [data-seed-title]')
  ).toBeVisible()
  for (const heading of ['#identities-title', '#floors-title']) {
    const icon = page.locator(heading).locator('xpath=..').locator('.pixelated')
    await expect(icon.first()).toBeVisible()
  }

  const item = page
    .locator('[data-floor-depth="7"]')
    .getByRole('button', { name: /^Blazing assassin's blade/ })
  await item.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => ({
    y: window.scrollY,
    height: document.documentElement.scrollHeight,
  }))
  await item.click()
  const detail = page.locator('[data-slot="item-detail"]')
  await expect(detail).toBeVisible()
  const after = await page.evaluate(() => ({
    y: window.scrollY,
    height: document.documentElement.scrollHeight,
  }))
  expect(after).toEqual(before)
  await page.keyboard.press('Escape')
  await expect(detail).toHaveCount(0)

  const potion = page.getByRole('button', {
    name: 'Potion of strength (crimson)',
    exact: true,
  })
  await potion.hover()
  await expect(
    page.getByRole('dialog', { name: 'Potion of strength' })
  ).toContainText('permanently increasing your strength by one point')
  await expect(detail).toContainText('Unidentified appearance: Crimson')
  const scroll = page.getByRole('button', {
    name: 'Scroll of upgrade (kaunan)',
    exact: true,
  })
  await scroll.press('Enter')
  await expect(
    page.getByRole('dialog', { name: 'Scroll of upgrade' })
  ).toContainText('upgrade a single item')
  await page.keyboard.press('Escape')
  await expect(detail).toHaveCount(0)
  expectNoBrowserErrors(errors)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('a partial match sits below the seed, and an identity opens on tap', async ({
    page,
  }) => {
    const reports = await loadReportFixtures()
    const seed = 'AAA-AAA-AAA'
    const report = reports[seed]
    if (!report) throw new Error(`Missing fixture for ${seed}`)
    report.query = { matchedRequirements: 2, totalRequirements: 3 }
    await openApp(page)
    await installFakeReportWorker(page, reports)
    await page.goto(`/?scout=${seed}`)

    const summary = page.locator(
      '[data-slot="game-window"] + [data-query-summary]'
    )
    await expect(summary).toHaveText('Matches 2 of 3 query requirements.')
    await expect(summary).toHaveAttribute('data-variant', 'warning')
    const ring = page.getByRole('button', {
      name: 'Ring of accuracy (ruby)',
      exact: true,
    })
    await ring.tap()
    const detail = page.getByRole('dialog', { name: 'Ring of accuracy' })
    await expect(detail).toContainText('Unidentified appearance: Ruby')
    await expect(detail.locator('[data-slot="badge"]')).toHaveText('Ruby')
    await expect(detail).toContainText('This ring increases your focus')
    const box = await detail.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
    await ring.tap()
    await expect(detail).toHaveCount(0)
  })
})
