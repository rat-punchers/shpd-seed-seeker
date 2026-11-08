import { expect, type Page, test } from '@playwright/test'
import { loadPreset, selectOption } from './helpers/advanced'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import { itemPicker } from './helpers/item-picker'

const viewTab = (page: Page, name: 'Simple' | 'Advanced') =>
  page
    .getByRole('tablist', { name: 'Query view' })
    .getByRole('tab', { name, exact: true })

const sheet = (page: Page) => page.getByRole('dialog')

/** A requirement chip, by the description the core gives it. */
const chip = (page: Page, description: RegExp) =>
  page
    .locator('[data-slot="chip"]')
    .and(page.getByRole('button', { name: description }))

/** Adds an Any weapon with the Blazing enchantment through the sheet. */
async function addBlazingWeapon(page: Page) {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  await expect(
    sheet(page).getByRole('heading', { name: 'New Requirement' })
  ).toBeVisible()
  await sheet(page)
    .getByRole('radiogroup', { name: 'Enchantment filter' })
    .getByRole('radio', { name: 'Specific…' })
    .click()
  await sheet(page).getByRole('switch', { name: 'Blazing' }).click()
  await expect(sheet(page)).toContainText('Matches any one of 1 effect.')
  await sheet(page).getByRole('button', { name: 'Add Requirement' }).click()
  await expect(sheet(page)).toHaveCount(0)
}

for (const viewport of [
  { width: 1440, height: 1200 },
  { width: 390, height: 844 },
]) {
  test(`an enchanted requirement makes Simple show the Advanced banner, and Clear returns to Simple at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const errors = collectBrowserErrors(page)
    await openApp(page, { mode: 'find' })
    await expect(viewTab(page, 'Simple')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await viewTab(page, 'Advanced').click()
    await expect(page.getByTestId('requirement-count')).toHaveText(
      'No requirements'
    )

    await addBlazingWeapon(page)
    await expect(chip(page, /^Any weapon.*Blazing/)).toBeVisible()
    await expect(page.getByTestId('requirement-count')).toHaveText(
      '1 requirement'
    )
    await expect(page.getByTestId('query-estimate')).toContainText(
      'Match probability'
    )

    await viewTab(page, 'Simple').click()
    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'Advanced query active' })
    await expect(banner).toBeVisible()
    await expect(itemPicker(page, 1)).toHaveCount(0)

    // The banner's way back to the whole query.
    await banner.getByRole('button', { name: 'Edit in Advanced' }).click()
    await expect(viewTab(page, 'Advanced')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(chip(page, /^Any weapon/)).toBeVisible()

    await viewTab(page, 'Simple').click()
    await banner.getByRole('button', { name: 'Clear' }).click()
    await expect(banner).toHaveCount(0)
    await expect(
      page.getByText('Add the items a seed must hold.')
    ).toBeVisible()
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(itemPicker(page, 1)).toBeVisible()
    expectNoBrowserErrors(errors)
  })
}

test('the sheet picks its item and source from searchable, grouped lists', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page, { mode: 'find', 'find-view': 'advanced' })
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()

  await sheet(page).getByRole('combobox', { name: 'Item' }).click()
  const search = page.getByLabel('Search item')
  await expect(search).toBeFocused()
  await expect(
    page.getByRole('group', { name: 'Melee weapons · Tier 3' })
  ).toBeVisible()
  await search.fill('wand of fro')
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.getByRole('option', { name: 'Wand of Frost' }).click()
  await expect(page.getByLabel('Search item')).toHaveCount(0)
  await expect(sheet(page).getByRole('combobox', { name: 'Item' })).toHaveText(
    'Wand of Frost'
  )

  await selectOption(
    page,
    sheet(page).getByRole('combobox', { name: 'Source' }),
    'Wandmaker reward'
  )
  await expect(
    sheet(page).getByRole('combobox', { name: 'Source' })
  ).toHaveText('Wandmaker reward')
  // The sheet stays open under the pickers.
  await sheet(page).getByRole('button', { name: 'Add Requirement' }).click()
  await expect(chip(page, /^Wand of Frost/)).toBeVisible()
  expectNoBrowserErrors(errors)
})

test('a preset loads into the board, saves under a name, and Copy JSON copies its document', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = collectBrowserErrors(page)
  await openApp(page, { mode: 'find', 'find-view': 'advanced' })
  await loadPreset(page, 'Necromancer')
  await expect(chip(page, /^Wand of Corruption/)).toBeVisible()
  await expect(page.getByTestId('requirement-count')).toHaveText(
    '3 requirements'
  )

  await page.getByRole('button', { name: 'Copy this search as JSON' }).click()
  await expect(
    page.getByRole('button', { name: 'Copy this search as JSON' })
  ).toContainText('Copied')
  const copied = JSON.parse(
    await page.evaluate(() => navigator.clipboard.readText())
  ) as { wandmaker_quest?: string; max_depth?: number }
  expect(copied).toMatchObject({
    wandmaker_quest: 'corpse_dust',
    max_depth: 14,
  })

  await page.getByRole('button', { name: 'Save…' }).click()
  await page.getByLabel('Preset name').fill('My necro')
  await page.getByLabel('Preset name').press('Enter')
  const saved = page.getByRole('list', { name: 'Saved presets' })
  await expect(
    saved.getByRole('button', { name: 'My necro', exact: true })
  ).toBeVisible()
  await page.reload()
  await expect(
    saved.getByRole('button', { name: 'My necro', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Delete preset My necro' }).click()
  await expect(saved).toHaveCount(0)
  expectNoBrowserErrors(errors)
})

test('Share copies a link to this app that opens the same query in Advanced', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = collectBrowserErrors(page)
  await openApp(page, { mode: 'find', 'find-view': 'advanced' })
  await addBlazingWeapon(page)
  await page
    .getByRole('button', { name: 'Copy a shareable link to this search' })
    .click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:46001\/#q=/)

  // A fresh visitor opens the link with nothing saved.
  await page.evaluate(() => localStorage.clear())
  await page.close()
  const visitor = await context.newPage()
  const visitorErrors = collectBrowserErrors(visitor)
  await visitor.goto(link)
  await expect(viewTab(visitor, 'Advanced')).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(chip(visitor, /^Any weapon.*Blazing/)).toBeVisible()
  await expect.poll(() => visitor.evaluate(() => window.location.hash)).toBe('')
  expectNoBrowserErrors(errors)
  expectNoBrowserErrors(visitorErrors)
})

test('a share link that cannot be read says why, and the notice dismisses', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  await page.goto('/#q=not-a-share-code')
  const notice = page
    .getByRole('alert')
    .filter({ hasText: "This share link couldn't be loaded" })
  await expect(notice).toBeVisible()
  await expect(viewTab(page, 'Advanced')).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await notice.getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice).toHaveCount(0)
  expectNoBrowserErrors(errors)
})
