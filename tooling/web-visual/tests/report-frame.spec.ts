import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'

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
  expectNoBrowserErrors(errors)
})
