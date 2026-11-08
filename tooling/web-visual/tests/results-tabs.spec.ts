import { expect, type Page, test } from '@playwright/test'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'

const resultsTabs = (page: Page) =>
  page.getByRole('tablist', { name: 'Results', exact: true })
const seedTabs = (page: Page) =>
  page.getByRole('tablist', { name: 'Open seeds' })
const modeTab = (page: Page, name: 'Analyze' | 'Find') =>
  page.getByRole('tablist', { name: 'Mode' }).getByRole('tab', { name })
const seedTitle = (page: Page) => page.locator('[data-seed-title]')
const cardCode = async (page: Page, index: number) =>
  (await page
    .getByTestId('result-card')
    .nth(index)
    .getByRole('heading')
    .textContent()) ?? ''

test('results tabs keep their searches, survive a reload and name the Analyze tab', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page, {
    mode: 'find',
    query: JSON.stringify({
      auto_apply_trinket: true,
      max_depth: 24,
      requirements: [{ kind: 'ring' }],
    }),
  })
  await expect(
    resultsTabs(page).getByRole('tab', { name: 'Results #1' })
  ).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(page.getByTestId('result-card').nth(2)).toBeVisible()
  const first = await cardCode(page, 0)
  const third = await cardCode(page, 2)

  await page
    .getByTestId('result-card')
    .first()
    .getByRole('button', { name: 'Analyze seed' })
    .click()
  await expect(seedTabs(page).getByRole('tab')).toHaveText(['Results #1'])
  await expect(seedTitle(page)).toHaveText(first)

  await modeTab(page, 'Find').click()
  await page.getByRole('button', { name: 'New results tab' }).click()
  await expect(
    resultsTabs(page).getByRole('tab', { name: 'Results #2' })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('heading', { name: 'No search yet' })
  ).toBeVisible()
  await resultsTabs(page).getByRole('tab', { name: 'Results #1' }).click()
  await expect(page.getByTestId('result-card').first()).toHaveText(
    new RegExp(first)
  )

  await page.reload()
  await expect(resultsTabs(page).getByRole('tab')).toHaveText([
    'Results #1',
    'Results #2',
  ])
  await expect(page.getByTestId('result-card').first()).toHaveText(
    new RegExp(first)
  )
  // Another seed of the same results replaces the seed in its Analyze tab.
  await page
    .getByTestId('result-card')
    .nth(2)
    .getByRole('button', { name: 'Analyze seed' })
    .click()
  await expect(seedTabs(page).getByRole('tab')).toHaveText(['Results #1'])
  await expect(seedTitle(page)).toHaveText(third)
  expectNoBrowserErrors(errors)
})

test('a search shows on the Find tab from Analyze and resumes after a reload', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  // Two rows that rarely meet, so the search is still scanning.
  await openApp(page, {
    mode: 'find',
    query: JSON.stringify({
      auto_apply_trinket: true,
      max_depth: 4,
      requirements: [
        { kind: 'weapon', item: 'longsword', upgrade: { at_least: 3 } },
        { kind: 'ring', item: 'ring_wealth' },
      ],
    }),
  })
  await expect(page.getByTestId('query-estimate')).toContainText('1 in')
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  const status = page.getByRole('status').filter({ hasText: /^Searching$/ })
  await expect(status).toBeVisible()

  await modeTab(page, 'Analyze').click()
  await expect(page.getByTestId('find-searching')).toBeVisible()
  await expect(modeTab(page, 'Find')).toHaveAccessibleName(/searching/)
  // Let a progress save land, then leave mid-search.
  await page.waitForTimeout(1_500)
  page.on('dialog', (dialog) => void dialog.accept())
  await page.reload()

  await expect(page.getByTestId('find-searching')).toHaveCount(0)
  await modeTab(page, 'Find').click()
  await expect(
    page.getByRole('status').filter({ hasText: /^Cancelled$/ })
  ).toBeVisible()
  await expect(page.getByText(/^Tested .+ in /)).not.toHaveText(/^Tested 0 in/)
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(status).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: /^Cancelled$/ })
  ).toBeVisible()
  expectNoBrowserErrors(errors)
})
