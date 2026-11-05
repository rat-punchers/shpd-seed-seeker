import { defineConfig } from '@playwright/test'

// web-v2's preview port, from the repository's block (see AGENTS.md).
const PORT = 46001
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  snapshotPathTemplate: '{testDir}/../snapshots/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'line',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    toMatchSnapshot: {
      maxDiffPixels: 0,
      threshold: 0,
    },
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixels: 0,
      scale: 'css',
      threshold: 0,
    },
  },
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    timezoneId: 'UTC',
    viewport: { width: 1440, height: 1200 },
  },
  // Serves the production build in web-v2/dist; build it first
  // (`bun run test:visual` does).
  webServer: {
    command: `bun run preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: '../../web-v2',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
