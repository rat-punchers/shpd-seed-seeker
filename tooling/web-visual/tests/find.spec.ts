import { expect, type Page, test } from '@playwright/test'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import { editItem, itemPicker } from './helpers/item-picker'

const SEED_CODE = /^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}$/

/** Opens Find with an empty query and adds one item row. */
async function openFindWithOneRow(page: Page) {
  await openApp(page, { mode: 'find' })
  await page.getByRole('button', { name: 'Add item' }).click()
  await expect(itemPicker(page, 1)).toBeVisible()
}

test('a query every seed matches finds its first seed and hands it to Analyze', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openFindWithOneRow(page)
  // Any ring by floor 24: every seed holds one.
  await editItem(page, 1, { item: 'Any ring', floor: 24 })
  await expect(
    page.getByRole('status').filter({ hasText: 'Match probability' })
  ).toHaveText('Match probability ≈ 1 in 1')

  await page.getByRole('button', { name: 'Find', exact: true }).click()
  const first = page.getByTestId('result-card').first()
  await expect(first).toBeVisible()
  const code = (await first.getByRole('heading').textContent()) ?? ''
  expect(code).toMatch(SEED_CODE)
  await expect(first).toContainText('Result 1')
  // A query every seed matches stops at the result limit. Filling 1,024
  // results takes over 15 s on a 4-core CI runner.
  await expect(
    page.getByText('Result limit reached (1,024 seeds).')
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    page.getByRole('button', { name: 'Find', exact: true })
  ).toBeEnabled()

  await first.getByRole('button', { name: 'Analyze seed' }).click()
  await expect(
    page
      .getByRole('tablist', { name: 'Mode' })
      .getByRole('tab', { name: 'Analyze' })
  ).toHaveAttribute('aria-selected', 'true')
  expectNoBrowserErrors(errors)
})

test('Ctrl+Enter starts and cancels a search, and leaving asks first', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  // Two rows that rarely meet, so the search is still scanning when cancelled.
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
  await expect(itemPicker(page, 2)).toContainText('Ring of Wealth')
  await expect(page.getByTestId('query-estimate')).toContainText('1 in')

  await page.keyboard.press('Control+Enter')
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await expect(page.getByText('Searching', { exact: true })).toBeVisible()
  // The item rows are locked while the search runs.
  await expect(itemPicker(page, 1)).toBeDisabled()

  const dialog = page.waitForEvent('dialog')
  void page.close({ runBeforeUnload: true }).catch(() => undefined)
  const leave = await dialog
  expect(leave.type()).toBe('beforeunload')
  await leave.dismiss()
  expect(page.isClosed()).toBe(false)

  await page.keyboard.press('Control+Enter')
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(itemPicker(page, 1)).toBeEnabled()
  expectNoBrowserErrors(errors)
})

for (const viewport of [
  { width: 1440, height: 1200 },
  { width: 390, height: 844 },
]) {
  test(`an impossible query explains why and cannot start at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const errors = collectBrowserErrors(page)
    await openFindWithOneRow(page)
    // Wand of Lightning +3 first generates on floor 7.
    await editItem(page, 1, {
      item: 'Wand of Lightning',
      upgrade: 3,
      floor: 6,
    })

    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Impossible query' })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(
      'Requirement 1 (Wand of lightning) needs floor 7 or later, beyond its floor limit.'
    )
    await expect(
      page.getByRole('button', { name: 'Find', exact: true })
    ).toBeDisabled()
    await page.keyboard.press('Control+Enter')
    await expect(
      page.getByRole('heading', { name: 'No search yet' })
    ).toBeVisible()

    // One floor deeper the query is possible again.
    await editItem(page, 1, { floor: 7 })
    await expect(alert).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Find', exact: true })
    ).toBeEnabled()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
    expectNoBrowserErrors(errors)
  })
}
