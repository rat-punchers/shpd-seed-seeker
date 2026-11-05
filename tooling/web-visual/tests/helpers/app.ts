import type { Page } from '@playwright/test'

/** web-v2's localStorage prefix (web-v2/src/config.ts). */
export const STORAGE_PREFIX = 'seed-seeker-v2-'

/**
 * Opens the app on a clean slate: light theme, reduced motion, and only the
 * given localStorage entries (keys without the prefix). Storage is cleared
 * once per test, so reloads keep what the app wrote.
 */
export async function openApp(
  page: Page,
  storage: Record<string, string> = {}
): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.addInitScript(
    ({ prefix, entries }) => {
      const marker = `${prefix}visual-test-initialized`
      if (sessionStorage.getItem(marker) === 'true') return
      localStorage.clear()
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(prefix + key, value)
      }
      sessionStorage.setItem(marker, 'true')
    },
    { prefix: STORAGE_PREFIX, entries: storage }
  )
  await page.goto('/')
}
