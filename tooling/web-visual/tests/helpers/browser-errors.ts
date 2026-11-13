import { expect, type Page } from '@playwright/test'

export interface BrowserErrors {
  console: string[]
  page: string[]
}

/** Records console errors and uncaught exceptions from the moment it is called. */
export function collectBrowserErrors(page: Page): BrowserErrors {
  const errors: BrowserErrors = { console: [], page: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  return errors
}

export function expectNoBrowserErrors(errors: BrowserErrors): void {
  expect(errors.console, 'console errors').toEqual([])
  expect(errors.page, 'page errors').toEqual([])
}
