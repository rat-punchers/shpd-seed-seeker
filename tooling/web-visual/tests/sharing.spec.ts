import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { openApp, settleSearchResults } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'

const replay =
  '/analyze?seed=AAA-AAA-AAA&challenge=into_darkness&lore=1&trinket=mimic_tooth'

test('every screen serves a static social card and a CSP-compatible boot shell', async ({
  request,
}) => {
  const paths = [
    ['/', 'Seed Seeker'],
    [replay, 'Analyze a Seed · Seed Seeker'],
    ['/find', 'Find Seeds · Seed Seeker'],
    ['/find/advanced?share=1', 'Advanced Seed Search · Seed Seeker'],
  ] as const
  const headers = await (await request.get('/_headers')).text()
  for (const [path, title] of paths) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    const canonical = `https://seedseeker.nerdcoder.xyz${path.split('?')[0]}`
    expect(html).toContain(`<title>${title}</title>`)
    expect(html).toContain(`<link rel="canonical" href="${canonical}"`)
    expect(html).toContain(`<meta property="og:title" content="${title}"`)
    expect(html).toContain(`<meta property="og:url" content="${canonical}"`)
    expect(html).toContain('og:description')
    expect(html).toContain('https://seedseeker.nerdcoder.xyz/social-card.png')
    expect(html).toContain('Loading Seed Seeker…')
    expect(html).toContain('rel="preload"')
    const scripts = [
      ...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g),
    ]
    expect(scripts.length).toBeGreaterThanOrEqual(2)
    for (const [, body = ''] of scripts) {
      const hash = createHash('sha256').update(body).digest('base64')
      expect(headers).toContain(`'sha256-${hash}'`)
    }
  }
  const image = await request.get('/social-card.png')
  expect(image.ok()).toBe(true)
  expect(image.headers()['content-type']).toContain('image/png')
})

test('screens initialize from the route and only stores change the in-app route', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await page.goto('/find/advanced')
  const mode = page.getByRole('tablist', { name: 'Mode' })
  const views = page.getByRole('tablist', { name: 'Query view' })
  await expect(views.getByRole('tab', { name: 'Advanced' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  const historySize = await page.evaluate(() => history.length)
  await views.getByRole('tab', { name: 'Simple' }).click()
  await expect(page).toHaveURL(/\/find$/)
  await page.evaluate(() => {
    history.replaceState(null, '', '/analyze?seed=ABC-DEF-GHI')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(views.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await mode.getByRole('tab', { name: 'Analyze' }).click()
  await expect(page).toHaveURL(/\/analyze$/)
  await expect(
    page.getByRole('heading', { name: 'No seeds analyzed yet' })
  ).toBeVisible()
  await mode.getByRole('tab', { name: 'Find' }).click()
  await expect(page).toHaveURL(/\/find$/)
  expect(await page.evaluate(() => history.length)).toBe(historySize)
  await page.goto('/find/advanced')
  await expect(views.getByRole('tab', { name: 'Advanced' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await page.goto('/find')
  await expect(views.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expectNoBrowserErrors(errors)
})

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`sharing at ${width}px opens the same replay in a fresh context`, async ({
    page,
    context,
    browser,
  }) => {
    const errors = collectBrowserErrors(page)
    await page.setViewportSize({ width, height })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/analyze?seed=AAA-AAA-AAA')
    const share = page.getByRole('button', { name: /^Share seed / })
    await page.getByRole('switch', { name: 'Use a fresh journal' }).click()
    const darkness = page.getByRole('button', { name: 'Into Darkness' })
    await expect(darkness).toBeEnabled()
    await darkness.click()
    const mimic = page.getByRole('radio', { name: 'Mimic Tooth' })
    await expect(mimic).toBeEnabled()
    await mimic.click()
    await expect(share).toBeEnabled()
    await expect(page).toHaveURL((url) => url.pathname + url.search === replay)
    await share.click()
    await expect(page.getByText('Seed link copied')).toBeVisible()
    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(link).toBe(new URL(replay, page.url()).href)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width)

    const visitor = await browser.newContext()
    try {
      const recipient = await visitor.newPage()
      const recipientErrors = collectBrowserErrors(recipient)
      await recipient.goto(link)
      await expect(recipient.locator('[data-seed-title]')).toHaveText(
        'AAA-AAA-AAA'
      )
      await expect(
        recipient.getByRole('switch', { name: 'Use a fresh journal' })
      ).toBeChecked()
      await expect(
        recipient.getByRole('button', { name: 'Into Darkness' })
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(
        recipient.getByRole('radio', { name: 'Mimic Tooth' })
      ).toBeChecked()
      await recipient.getByRole('button', { name: 'Close AAA-AAA-AAA' }).click()
      await expect(recipient).toHaveURL(/\/analyze$/)
      expectNoBrowserErrors(recipientErrors)
    } finally {
      await visitor.close()
    }
    expectNoBrowserErrors(errors)
  })
}

test('sharing a daily run offers the native sheet and a selectable link', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ url }: ShareData) =>
        document.body.setAttribute('data-shared', url ?? ''),
    })
    Object.defineProperty(navigator, 'clipboard', { value: undefined })
  })
  await page.goto('/analyze?seed=2026-01-01')
  await expect(page.getByText('Daily run', { exact: true })).toBeVisible()
  const share = page.getByRole('button', { name: /^Share seed / })
  await share.click()
  await expect(page.locator('body')).toHaveAttribute('data-shared', page.url())
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined })
  })
  await share.click()
  await expect(
    page.getByRole('textbox', { name: 'Seed share link' })
  ).toHaveValue(page.url())
})

test('reloading a result URL keeps the local Find context', async ({
  page,
}) => {
  await openApp(page, {
    mode: 'find',
    query: JSON.stringify({ requirements: [{ kind: 'ring' }] }),
  })
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  await settleSearchResults(page)
  const first = page.getByTestId('result-row').first()
  const seed = (await first.getByRole('heading').textContent()) ?? ''
  await first.getByRole('button', { name: 'Analyze seed' }).click()
  await expect(page).toHaveURL(new RegExp(`/analyze\\?seed=${seed}`))
  await expect(page.locator('[data-seed-title]')).toHaveText(seed)
  await page.reload()
  await expect(page.locator('[data-seed-title]')).toHaveText(seed)
  await expect(
    page.getByRole('navigation', { name: 'Search results' })
  ).toContainText(/Result 1 of/)
  await expect(page.locator('[data-query-summary]')).toBeVisible()
})
