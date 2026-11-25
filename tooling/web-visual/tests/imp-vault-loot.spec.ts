import { expect, test } from '@playwright/test'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'

test('the Imp quest lists every Vault prize with one shared item limit', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await page.goto('/analyze?seed=AAA-AAA-AAA')
  const floor = page.getByRole('region', { name: 'Floor 19', exact: true })
  const quest = floor.getByRole('region', { name: 'Ambitious Imp quest' })
  const treasure = quest.getByRole('region', { name: 'Vault treasure' })
  await expect(quest).toContainText(
    'You can take only one item out of the vault.'
  )
  await expect(treasure.locator('[data-slot="item-box"]')).toHaveCount(15)
  await expect(quest.locator('[data-slot="item-box"]')).toHaveCount(21)
  await expect(
    treasure.getByRole('button', { name: 'Ring of Arcana +2' })
  ).toBeVisible()
  await expect(
    treasure.getByRole('button', { name: /Fishing spear/i })
  ).toBeVisible()

  const notable = floor.getByRole('region', { name: 'Notable', exact: true })
  await expect(
    notable.getByRole('button', { name: /Scale armor.*\+2/i })
  ).toBeVisible()
  const other = floor.getByRole('region', { name: 'Other items' })
  await expect(
    other.getByRole('button', { name: /Potion of Liquid Flame/i })
  ).toBeVisible()
  await expect(
    other.getByRole('button', { name: /Fishing spear/i })
  ).toHaveCount(0)
  expectNoBrowserErrors(errors)
})
