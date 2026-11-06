import { expect, type JSHandle, type Page, test } from '@playwright/test'
import { openApp } from './helpers/app'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import { screenshotPng } from './helpers/screenshot-png'

interface FileSpec {
  name: string
  mimeType: string
  buffer: Buffer
}

const png = (name: string, lines: string[]): FileSpec => ({
  name,
  mimeType: 'image/png',
  buffer: screenshotPng(lines),
})

const seedTabs = (page: Page) =>
  page.getByRole('tablist', { name: 'Open seeds' })
const seedTitle = (page: Page) => page.locator('[data-seed-title]')
const dialog = (page: Page) => page.getByRole('dialog')
const seedSwitch = (page: Page, code: string) =>
  page.locator(`[id="screenshot-seed-${code}"]`)

/** A drag-and-drop payload holding `files`, built in the page. */
function dataTransferWith(
  page: Page,
  files: FileSpec[]
): Promise<JSHandle<DataTransfer>> {
  return page.evaluateHandle(
    (specs) => {
      const transfer = new DataTransfer()
      for (const spec of specs) {
        const bytes = Uint8Array.from(atob(spec.base64), (c) => c.charCodeAt(0))
        transfer.items.add(new File([bytes], spec.name, { type: spec.type }))
      }
      return transfer
    },
    files.map((file) => ({
      name: file.name,
      type: file.mimeType,
      base64: file.buffer.toString('base64'),
    }))
  )
}

test('an opened screenshot lists its seeds and opens the chosen ones as tabs', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  await page.getByLabel('Enter your seed').pressSequentially('aaaaaaaaa')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(seedTitle(page)).toHaveText('AAA-AAA-AAA')

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open screenshot' }).click()
  await (await chooser).setFiles(
    png('stats.png', [
      'HERO',
      'SEED AAA-AAA-AAA',
      'SEED RZN-LKU-EFS',
      'SEED BBB-BBB-BBB',
    ])
  )

  await expect(
    dialog(page).getByRole('heading', { name: '3 seeds found' })
  ).toBeVisible()
  // Each code shows its crop of the screenshot; an open seed is marked.
  for (const code of ['AAA-AAA-AAA', 'RZN-LKU-EFS', 'BBB-BBB-BBB']) {
    const preview = dialog(page).getByRole('img', {
      name: `${code} as shown in the screenshot`,
    })
    await expect(preview).toBeVisible()
    expect(
      await preview.evaluate((img: HTMLImageElement) => img.naturalHeight)
    ).toBe(72)
  }
  await expect(dialog(page).getByText('Open', { exact: true })).toHaveCount(1)

  // Every seed starts chosen; the action counts the chosen ones.
  const analyzeButton = dialog(page).getByRole('button', { name: /^Analyze/ })
  await expect(analyzeButton).toHaveText('Analyze 3 seeds')
  await seedSwitch(page, 'BBB-BBB-BBB').click()
  await seedSwitch(page, 'RZN-LKU-EFS').click()
  await seedSwitch(page, 'AAA-AAA-AAA').click()
  await expect(analyzeButton).toBeDisabled()
  await seedSwitch(page, 'RZN-LKU-EFS').click()
  await expect(analyzeButton).toHaveText('Analyze seed')
  await seedSwitch(page, 'AAA-AAA-AAA').click()
  await expect(analyzeButton).toHaveText('Analyze 2 seeds')
  await analyzeButton.click()

  await expect(dialog(page)).toHaveCount(0)
  await expect(seedTabs(page).getByRole('tab')).toHaveText([
    'AAA-AAA-AAA',
    'RZN-LKU-EFS',
  ])
  await expect(
    seedTabs(page).getByRole('tab', { name: 'RZN-LKU-EFS' })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(seedTitle(page)).toHaveText('RZN-LKU-EFS')
  expectNoBrowserErrors(errors)
})

test('a screenshot dropped or pasted on the page is read', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  const transfer = await dataTransferWith(page, [
    png('stats.png', ['SEED RZN-LKU-EFS']),
  ])

  // A drag shows the drop target; leaving the page puts the dialog away.
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: transfer })
  await expect(
    dialog(page).getByRole('heading', { name: 'Drop screenshot' })
  ).toBeVisible()
  await page.dispatchEvent('body', 'dragleave', { dataTransfer: transfer })
  await expect(dialog(page)).toHaveCount(0)

  await page.dispatchEvent('body', 'dragenter', { dataTransfer: transfer })
  await page.dispatchEvent('body', 'dragover', { dataTransfer: transfer })
  await page.dispatchEvent('body', 'drop', { dataTransfer: transfer })
  await expect(
    dialog(page).getByRole('heading', { name: 'Seed found' })
  ).toBeVisible()
  await expect(seedSwitch(page, 'RZN-LKU-EFS')).toBeChecked()
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(seedTabs(page)).toHaveCount(0)

  await page.evaluate((data) => {
    window.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true })
    )
  }, transfer)
  await dialog(page).getByRole('button', { name: 'Analyze seed' }).click()
  await expect(seedTitle(page)).toHaveText('RZN-LKU-EFS')
  expectNoBrowserErrors(errors)
})

test('files without a readable seed explain what went wrong', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await openApp(page)
  const heading = (name: string) => dialog(page).getByRole('heading', { name })
  const tryAnother = async (file: FileSpec) => {
    const chooser = page.waitForEvent('filechooser')
    await dialog(page)
      .getByRole('button', { name: 'Try another screenshot' })
      .click()
    await (await chooser).setFiles(file)
  }

  const text = await dataTransferWith(page, [
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') },
  ])
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: text })
  await page.dispatchEvent('body', 'drop', { dataTransfer: text })
  await expect(heading('That file is not an image')).toBeVisible()

  await tryAnother(png('stats.png', ['STRENGTH', 'ABC-DEF', 'ABCDEFGHI']))
  await expect(heading('No seed found')).toBeVisible()

  await tryAnother({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a png'),
  })
  await expect(heading('Could not open that image')).toBeVisible()
  await dialog(page)
    .locator('[data-slot="dialog-footer"]')
    .getByRole('button', { name: 'Close' })
    .click()
  await expect(dialog(page)).toHaveCount(0)
  expectNoBrowserErrors(errors)
})
