import { expect, type Page, test } from '@playwright/test'
import { loadPreset, sectionToggle } from './helpers/advanced'
import { openApp, STORAGE_PREFIX } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'

const stored = (page: Page, key: string) =>
  page.evaluate((name) => localStorage.getItem(name), STORAGE_PREFIX + key)

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains('dark'))

test('the mode tabs switch workspaces and the choice survives a reload', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  const tabs = page.getByRole('tablist', { name: 'Mode' })
  const analyze = tabs.getByRole('tab', { name: 'Analyze' })
  const find = tabs.getByRole('tab', { name: 'Find' })

  await expect(analyze).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('heading', { name: 'No seeds analyzed yet' })
  ).toBeVisible()

  await find.click()
  await expect(find).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('heading', { name: 'No search yet' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'No seeds analyzed yet' })
  ).toBeHidden()
  expect(await stored(page, 'mode')).toBe('find')

  await page.reload()
  await expect(find).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('heading', { name: 'No search yet' })
  ).toBeVisible()

  // Keyboard: arrow keys move between the tabs.
  await find.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(analyze).toHaveAttribute('aria-selected', 'true')
  expect(await stored(page, 'mode')).toBe('analyze')
  expectNoBrowserErrors(errors)
})

test('opening in Find shows a loading screen until Find has loaded', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/assets/find-chunk-*.js', async (route) => {
    await held
    await route.continue()
  })
  await openApp(page, { mode: 'find' })

  await expect(
    page.getByRole('status').filter({ hasText: 'Loading Seed Seeker…' })
  ).toBeVisible()
  release()
  await expect(
    page.getByRole('heading', { name: 'No search yet' })
  ).toBeVisible()
  await expect(page.getByText('Loading Seed Seeker…')).toBeHidden()
  expectNoBrowserErrors(errors)
})

test('the theme toggle cycles system → light → dark and persists', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  const toggle = () => page.getByRole('button', { name: /^Theme: / })

  await expect(toggle()).toHaveAccessibleName('Theme: System. Click for Light.')
  expect(await isDark(page)).toBe(false)

  await toggle().click()
  await expect(toggle()).toHaveAccessibleName('Theme: Light. Click for Dark.')
  expect(await isDark(page)).toBe(false)
  expect(await stored(page, 'theme')).toBe('light')

  await toggle().click()
  await expect(toggle()).toHaveAccessibleName('Theme: Dark. Click for System.')
  expect(await isDark(page)).toBe(true)
  expect(await stored(page, 'theme')).toBe('dark')

  // The pre-paint script applies the stored theme before the app loads.
  await page.route('**/assets/*.js', (route) => route.abort())
  await page.reload()
  expect(await isDark(page)).toBe(true)
  await page.unrouteAll()
  await page.reload()
  await expect(toggle()).toHaveAccessibleName('Theme: Dark. Click for System.')

  await toggle().click()
  await expect(toggle()).toHaveAccessibleName('Theme: System. Click for Light.')
  expect(await isDark(page)).toBe(false)
  // System follows the OS setting.
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => isDark(page)).toBe(true)
  expect(errors.page).toEqual([])
  // Only the aborted bundle requests may log errors.
  expect(errors.console.filter((text) => !text.includes('net::'))).toEqual([])
})

test('footer links serve the license and asset attribution', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText('Shattered Pixel Dungeon v4.0.2')
  await expect(footer).toContainText('GPL-3.0-or-later')
  for (const name of ['License', 'Asset attribution']) {
    const href = await footer.getByRole('link', { name }).getAttribute('href')
    expect(href).toBeTruthy()
    const response = await page.request.get(href ?? '')
    expect(response.status(), href ?? '').toBe(200)
  }
  expectNoBrowserErrors(errors)
})

test('at 390px the sidebar stacks above the workspace and fits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = collectBrowserErrors(page)
  await openApp(page)

  const sidebar = page.getByRole('complementary')
  const main = page.getByRole('main')
  const sidebarBox = await sidebar.boundingBox()
  const mainBox = await main.boundingBox()
  expect(sidebarBox?.width).toBe(390)
  expect(mainBox?.y ?? 0).toBeGreaterThanOrEqual(
    (sidebarBox?.y ?? 0) + (sidebarBox?.height ?? 0)
  )

  await page.getByRole('tab', { name: 'Find' }).click()
  await expect(
    page.getByRole('heading', { name: 'No search yet' })
  ).toBeVisible()
  await page.getByRole('button', { name: /^Theme: / }).click()
  await expect(page.getByRole('contentinfo')).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
  expectNoBrowserErrors(errors)
})

test('on desktop a long Advanced query scrolls inside the sidebar, not the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 })
  const errors = collectBrowserErrors(page)
  await openApp(page, { mode: 'find', 'find-view': 'advanced' })
  await loadPreset(page, 'Necromancer')
  for (const name of ['Wandmaker', 'Challenges'])
    await sectionToggle(page, name).click()

  const scroll = page.getByTestId('find-query-scroll')
  const heights = await scroll.evaluate((node) => ({
    client: node.clientHeight,
    scroll: node.scrollHeight,
    page: document.documentElement.scrollHeight,
  }))
  expect(heights.scroll).toBeGreaterThan(heights.client)
  expect(heights.page).toBe(700)
  await expect(
    page.getByRole('tablist', { name: 'Query view' })
  ).toBeInViewport()
  await expect(
    page.getByRole('button', { name: 'Find', exact: true })
  ).toBeInViewport()
  expectNoBrowserErrors(errors)
})
