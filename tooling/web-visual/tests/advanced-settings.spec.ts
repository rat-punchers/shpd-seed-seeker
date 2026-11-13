import { expect, type Page, test } from '@playwright/test'
import { sectionToggle, selectOption } from './helpers/advanced'
import { openApp, STORAGE_PREFIX } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'

const viewTab = (page: Page, name: 'Simple' | 'Advanced') =>
  page
    .getByRole('tablist', { name: 'Query view' })
    .getByRole('tab', { name, exact: true })

/** A collapsed settings section, opened. */
async function openSettings(page: Page, name: string) {
  await sectionToggle(page, name).click()
  return page.getByRole('region', { name, exact: true })
}

/** The saved query document, as the app wrote it. */
const savedQuery = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
    `${STORAGE_PREFIX}query`
  )

for (const viewport of [
  { width: 1440, height: 1200 },
  { width: 390, height: 844 },
]) {
  test(`Advanced settings change the saved query and survive a reload at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const errors = collectBrowserErrors(page)
    await openApp(page, { mode: 'find', 'find-view': 'advanced' })

    const floorLimit = page.getByRole('slider', { name: 'Floor limit' })
    await expect(floorLimit).toHaveAttribute('aria-valuetext', '24')
    await floorLimit.focus()
    await page.keyboard.press('Home')
    await expect(page.getByText('first 1 floor', { exact: true })).toBeVisible()

    // A farming floor past the limit raises it.
    const rooms = await openSettings(page, 'Rooms and feelings')
    const floor17 = rooms.getByRole('button', { name: 'Floor 17' })
    await floor17.click()
    await expect(floor17).toHaveAttribute('aria-pressed', 'true')
    await expect(floorLimit).toHaveAttribute('aria-valuetext', '17')
    await expect(page.getByTestId('requirement-count')).toHaveText(
      '1 requirement'
    )
    await rooms
      .getByRole('button', { name: 'About Ring of Wealth farming floors' })
      .click()
    await expect(page.getByText('Dark floor with a garden.')).toBeVisible()
    await page.keyboard.press('Escape')

    const quest = page
      .getByRole('region', { name: 'Wandmaker', exact: true })
      .getByLabel('Quest')
    await expect(quest).toBeHidden()
    const wandmaker = await openSettings(page, 'Wandmaker')
    await expect(quest).toBeVisible()
    await selectOption(page, wandmaker.getByLabel('Quest'), 'Rotberry')
    const blacksmith = await openSettings(page, 'Blacksmith')
    // A floor limit of 14 or more always meets him.
    await expect(
      blacksmith.getByRole('switch', { name: 'Require accessible blacksmith' })
    ).toBeDisabled()
    await blacksmith
      .getByRole('switch', { name: 'Exclude Smith rewards' })
      .click()
    const challenges = await openSettings(page, 'Challenges')
    await challenges.getByRole('switch', { name: 'Barren Land' }).click()
    await expect(sectionToggle(page, 'Challenges')).toContainText('1')

    await page.getByRole('switch', { name: 'AutoTrinket' }).click()
    await expect(page.getByTestId('query-estimate')).toContainText(
      'Match probability'
    )
    await expect
      .poll(() => savedQuery(page))
      .toMatchObject({
        max_depth: 17,
        wandmaker_quest: 'rotberry',
        exclude_blacksmith_rewards: true,
        challenges: ['barren_land'],
        floor_requirements: [
          {
            depth: 17,
            feeling: 'dark',
            any_rooms: ['garden', 'secret_garden'],
          },
        ],
      })

    await page.reload()
    await expect(viewTab(page, 'Advanced')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(floorLimit).toHaveAttribute('aria-valuetext', '17')
    await expect(
      page.getByRole('switch', { name: 'AutoTrinket' })
    ).toHaveAttribute('aria-checked', 'false')
    await expect(sectionToggle(page, 'Wandmaker')).toContainText('1')

    // Simple cannot show these settings.
    await viewTab(page, 'Simple').click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Advanced query active' })
    ).toBeVisible()
    expectNoBrowserErrors(errors)
  })
}

test('the worker count is its own setting, kept across reloads', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 })
  )
  await openApp(page, { mode: 'find', 'find-view': 'advanced' })
  const performance = await openSettings(page, 'Performance')
  await expect(performance).toContainText('4 of 4 cores')
  await performance.getByRole('slider', { name: 'Workers' }).focus()
  await page.keyboard.press('Home')
  await expect(performance).toContainText('1 of 4 cores')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Performance' })).toContainText(
    '1 of 4 cores'
  )
  expectNoBrowserErrors(errors)
})
