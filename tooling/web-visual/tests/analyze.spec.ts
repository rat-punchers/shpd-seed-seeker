import { expect, type Page, test } from '@playwright/test'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import {
  installFakeReportWorker,
  loadReportFixtures,
  loadSyntheticReportFixtures,
} from './helpers/fake-report-worker'

/** The open-seed tabs above the report. */
const seedTabs = (page: Page) =>
  page.getByRole('tablist', { name: 'Open seeds' })
const seedTitle = (page: Page) => page.locator('[data-seed-title]')
const seedField = (page: Page) => page.getByLabel('Enter your seed')

async function analyze(page: Page, typed: string, formatted: string) {
  await seedField(page).pressSequentially(typed)
  await expect(seedField(page)).toHaveValue(formatted)
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
}

test('a typed seed opens a tab with the engine report', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  await analyze(page, 'aaaaaaaaa', 'AAA-AAA-AAA')

  await expect(
    seedTabs(page).getByRole('tab', { name: 'AAA-AAA-AAA' })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(seedTitle(page)).toHaveText('AAA-AAA-AAA')
  await expect(seedField(page)).toHaveValue('')
  await expect(page.locator('[data-identities] [role="img"]')).toHaveCount(36)
  await expect(
    page.getByRole('navigation', { name: 'Floors' }).getByRole('button')
  ).toHaveCount(24)
  await expect(page.locator('[data-quest]')).toHaveCount(4)
  // The engine does not fill encounters yet, so none are drawn.
  await expect(page.getByLabel('Initial encounters')).toHaveCount(0)

  // The floor strip jumps to a floor; an item opens its description.
  await page.getByRole('button', { name: /^Floor 9, Prison/ }).click()
  await expect(page.locator('[data-rail-depth="9"]')).toHaveAttribute(
    'aria-current',
    'location'
  )
  const floor1 = page.locator('[data-floor-depth="1"]')
  await floor1.getByRole('button', { name: 'Wand of frost' }).click()
  const detail = page.locator('[data-slot="item-detail"]')
  await expect(detail).toContainText('Floor 1, Heap')
  await page.keyboard.press('Escape')
  await expect(detail).toHaveCount(0)
  expectNoBrowserErrors(errors)
})

test('invalid seeds cannot start, and the engine explains bad dates and links', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  const analyzeButton = page.getByRole('button', {
    name: 'Analyze',
    exact: true,
  })

  await seedField(page).pressSequentially('abc')
  await expect(seedField(page)).toHaveValue('ABC')
  await expect(analyzeButton).toBeDisabled()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: 'No seeds analyzed yet' })
  ).toBeVisible()

  await seedField(page).fill('')
  await analyze(page, '20261345', '2026-13-45')
  const failure = page.getByRole('alert').filter({ hasText: 'Analysis failed' })
  await expect(failure).toContainText(
    'daily date must be a real YYYY-MM-DD date'
  )

  // A link is grouped like typed text, so `nope` asks for `NOP-E`.
  await page.goto('/?scout=nope')
  await expect(seedTabs(page).getByRole('tab', { name: 'NOP-E' })).toBeVisible()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Analysis failed' })
  ).toContainText('seed code must contain nine A-Z characters')
  expectNoBrowserErrors(errors)
})

test('a ?scout= link opens its seed, and open tabs survive a reload', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page, { mode: 'find' })
  await page.goto('/?scout=rznlkuefs')
  await expect(
    page
      .getByRole('tablist', { name: 'Mode' })
      .getByRole('tab', { name: 'Analyze' })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(seedTitle(page)).toHaveText('RZN-LKU-EFS')
  await analyze(page, '2026-01-01', '2026-01-01')
  await expect(seedTitle(page)).toHaveText('2026-01-01')
  await expect(page.getByText('Daily run', { exact: true })).toBeVisible()

  await page.goto('/')
  await expect(seedTabs(page).getByRole('tab')).toHaveText([
    'RZN-LKU-EFS',
    '2026-01-01',
  ])
  await expect(seedTitle(page)).toHaveText('2026-01-01')
  await page.getByRole('button', { name: 'Close 2026-01-01' }).click()
  await expect(seedTabs(page).getByRole('tab')).toHaveText(['RZN-LKU-EFS'])
  await expect(seedTitle(page)).toHaveText('RZN-LKU-EFS')
  expectNoBrowserErrors(errors)
})

test('J and K walk Find results from Analyze', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openApp(page, {
    mode: 'find',
    query: JSON.stringify({
      auto_apply_trinket: true,
      max_depth: 24,
      requirements: [{ kind: 'ring' }],
    }),
  })
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  const cards = page.getByTestId('result-card')
  await expect(cards.nth(1)).toBeVisible()
  const first = (await cards.nth(0).getByRole('heading').textContent()) ?? ''
  const second = (await cards.nth(1).getByRole('heading').textContent()) ?? ''
  await cards.nth(0).getByRole('button', { name: 'Analyze seed' }).click()

  await expect(seedTitle(page)).toHaveText(first)
  const position = page.getByRole('navigation', { name: 'Search results' })
  await expect(position).toContainText(/Result 1 of \d+/)
  await page.keyboard.press('j')
  await expect(seedTitle(page)).toHaveText(second)
  await expect(position).toContainText(/Result 2 of/)
  // Navigation replaces the tab instead of opening another.
  await expect(seedTabs(page).getByRole('tab')).toHaveCount(1)
  await page.keyboard.press('k')
  await expect(seedTitle(page)).toHaveText(first)
  await position.getByRole('button', { name: 'Next result' }).click()
  await expect(seedTitle(page)).toHaveText(second)
  // Typing in the seed field does not navigate.
  await seedField(page).press('j')
  await expect(seedTitle(page)).toHaveText(second)
  expectNoBrowserErrors(errors)
})

test('sections the engine does not fill yet render from the synthetic report', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await installFakeReportWorker(page, {
    ...(await loadReportFixtures()),
    ...(await loadSyntheticReportFixtures()),
  })
  await openApp(page)
  await page.goto('/?scout=SYN-THE-TIC')
  await expect(seedTitle(page)).toHaveText('SYN-THE-TIC')
  await expect(page.locator('[data-query-summary]')).toHaveText(
    'Matches 1 of 2 query requirements.'
  )

  // Trinket timing: the Catalyst sits on its floor; later floors say what they hold.
  const floor3 = page.locator('[data-floor-depth="3"]')
  const band = floor3.locator('[data-trinket-choice]')
  await expect(band).toContainText('Floors 4+ are generated with Mimic Tooth.')
  await expect(
    page.locator('[data-floor-depth="4"]').getByRole('button', {
      name: 'Generated with Mimic Tooth. Change trinket',
    })
  ).toBeVisible()
  await expect(
    floor3.getByRole('img', { name: 'Alchemy pot, laboratory' })
  ).toBeVisible()

  // All items: a constrained item lists its conditions.
  await page
    .locator('[data-floor-depth="2"] [data-prediction="constrained"]')
    .click()
  const detail = page.locator('[data-slot="item-detail"]')
  await expect(detail).toContainText('Starts between +0 to +2.')
  await expect(detail).toContainText('On Diet is disabled')
  await page.keyboard.press('Escape')

  // Encounters and quest reward slots.
  await expect(
    page.locator('[data-floor-depth="1"]').getByLabel('Initial encounters')
  ).toContainText('12.5% runtime chance: Mystery Meat')
  await page
    .locator('[data-quest="wandmaker"]')
    .getByRole('button', { name: 'Wand reward outlook' })
    .click()
  const outlook = page
    .getByRole('dialog')
    .filter({ hasText: 'Wand reward outlook' })
  await expect(outlook).toContainText('Wand 1')
  await expect(outlook).toContainText('60%')
  await page.keyboard.press('Escape')
  await page
    .locator('[data-quest="imp"]')
    .getByRole('button', { name: 'Per-slot reward outlook' })
    .click()
  await expect(
    page.getByRole('dialog').filter({ hasText: 'Per-slot outlook' })
  ).toContainText('18 upgrades across the six options')
  await page.keyboard.press('Escape')

  // Picking another offer asks for a regenerated report.
  await band.getByRole('radio', { name: 'Dimensional Sundial' }).click()
  await expect(band).toHaveAttribute('aria-busy', 'false')
  expectNoBrowserErrors(errors)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('the report fits the width and a swipe steps through results', async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page)
    await openApp(page, {
      mode: 'find',
      query: JSON.stringify({
        max_depth: 24,
        requirements: [{ kind: 'ring' }],
      }),
    })
    await page.getByRole('button', { name: 'Find', exact: true }).click()
    const cards = page.getByTestId('result-card')
    await expect(cards.nth(1)).toBeVisible()
    const second = (await cards.nth(1).getByRole('heading').textContent()) ?? ''
    await cards.nth(0).getByRole('button', { name: 'Analyze seed' }).click()
    await expect(page.locator('[data-floor-depth="24"]')).toBeAttached()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)

    // A leftward swipe over the report opens the next result.
    await page.locator('[data-run-header]').evaluate((target) => {
      const touch = (x: number) =>
        new Touch({ identifier: 1, target, clientX: x, clientY: 300 })
      const fire = (type: string, x: number, active: boolean) =>
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            touches: active ? [touch(x)] : [],
            changedTouches: [touch(x)],
          })
        )
      fire('touchstart', 300, true)
      fire('touchend', 150, false)
    })
    await expect(seedTitle(page)).toHaveText(second)
    expectNoBrowserErrors(errors)
  })
})
