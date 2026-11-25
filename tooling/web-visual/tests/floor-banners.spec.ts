import { expect, test } from '@playwright/test'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'

test('ordinary and special floors show their staircase and the Crystal Mine shows its spire', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await page.goto('/analyze?seed=AAA-AAA-AAA')
  const stairs = (depth: number) =>
    page.locator(`[data-floor-depth="${depth}"] [data-floor-stairs]`)
  await expect(stairs(1)).toBeVisible()
  await expect(stairs(1)).not.toHaveAttribute('data-feeling')
  await expect(
    stairs(2).getByRole('img', { name: 'Chasm floor' })
  ).toBeVisible()
  await expect(
    page
      .locator('[data-floor-depth="5"]')
      .getByRole('img', { name: 'Boss: Goo' })
  ).toBeVisible()
  const quest = page.getByRole('region', { name: 'Troll Blacksmith quest' })
  const target = quest.getByRole('img', { name: 'Crystal guardian' })
  await expect(target).toBeVisible()
  await expect(target).toHaveCSS('background-size', '512px 128px')
  expectNoBrowserErrors(errors)
})

test('the Gnoll Mine shows its geomancer on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = collectBrowserErrors(page)
  await page.goto('/analyze?seed=RZN-LKU-EFS')
  const quest = page.getByRole('region', { name: 'Troll Blacksmith quest' })
  const target = quest.getByRole('img', { name: 'Gnoll geomancer' })
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeInViewport()
  await expect(target).toHaveCSS('background-size', '512px 64px')
  expectNoBrowserErrors(errors)
})
