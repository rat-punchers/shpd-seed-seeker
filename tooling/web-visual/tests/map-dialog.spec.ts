import { expect, test } from '@playwright/test'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import { waitForCanvasPaint } from './helpers/canvas'
import {
  analyzeSeed,
  dragStage,
  hoverMapPoint,
  openMap,
  panXOf,
  zoomOf,
} from './helpers/map-dialog'

const FLOOR_4 = { kind: 'main', depth: 4 } as const
// AAA-AAA-AAA floor 4: five energy crystals at cell 107 (column 13, row 2 of
// 47), raised 5 px; this is the centre of their sprite in map pixels.
const CRYSTALS = { x: 13 * 16 + 8, y: 2 * 16 + 3 }

test('the mobile map dialog fills the viewport and pans, zooms and closes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = collectBrowserErrors(page)
  await analyzeSeed(page, 'aaaaaaaaa', 'AAA-AAA-AAA')
  const { dialog, canvas, stage, trigger } = await openMap(page, FLOOR_4)
  await expect
    .poll(() => dialog.boundingBox())
    .toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await waitForCanvasPaint(canvas)

  await expect(stage).toHaveAttribute('data-zoom')
  const minZoom = Number(await stage.getAttribute('data-min-zoom'))
  const maxZoom = Number(await stage.getAttribute('data-max-zoom'))
  expect(await zoomOf(stage)).toBeCloseTo(minZoom, 3)
  await stage.hover()
  for (let step = 0; step < 24; step++) await page.mouse.wheel(0, -240)
  await expect.poll(() => zoomOf(stage)).toBeGreaterThan(maxZoom - 0.01)

  const settings = dialog.getByTestId('map-settings-panel')
  const panelBox = await settings.boundingBox()
  const zoomedPan = await panXOf(stage)
  await dragStage(page, stage, -120, 40)
  await expect.poll(() => panXOf(stage)).not.toBe(zoomedPan)
  // The controls stay put while the map moves under them.
  expect(await settings.boundingBox()).toEqual(panelBox)
  await expect(settings.getByRole('button')).toHaveCount(2)

  for (let step = 0; step < 24; step++) await page.mouse.wheel(0, 240)
  await expect.poll(() => zoomOf(stage)).toBeLessThan(minZoom + 0.01)

  // The close button is on top and takes a tap.
  const close = dialog.getByRole('button', { name: 'Close' })
  await expect
    .poll(() =>
      close.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        )
        return hit === node || node.contains(hit)
      })
    )
    .toBe(true)
  await close.click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  expectNoBrowserErrors(errors)
})

test('the desktop map dialog is large and zooms with its buttons and keys', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await analyzeSeed(page, 'aaaaaaaaa', 'AAA-AAA-AAA')
  const { dialog, canvas, stage } = await openMap(page, FLOOR_4)
  await expect
    .poll(async () => (await dialog.boundingBox())?.width)
    .toBeGreaterThan(1200)
  await expect
    .poll(async () => (await dialog.boundingBox())?.height)
    .toBeGreaterThan(1100)
  await waitForCanvasPaint(canvas)

  const zoomIn = dialog.getByRole('button', { name: 'Zoom map in' })
  const zoomOut = dialog.getByRole('button', { name: 'Zoom map out' })
  const fitted = await zoomOf(stage)
  await expect(zoomOut).toHaveAttribute('aria-disabled', 'true')
  await zoomIn.click()
  await expect.poll(() => zoomOf(stage)).toBeCloseTo(fitted * 1.5, 3)
  await expect(zoomOut).toHaveAttribute('aria-disabled', 'false')
  await zoomOut.click()
  await expect.poll(() => zoomOf(stage)).toBeCloseTo(fitted, 3)

  await stage.hover()
  for (let step = 0; step < 6; step++) await page.mouse.wheel(0, -400)
  await expect.poll(() => zoomOf(stage)).toBeGreaterThan(fitted)
  const beforeDrag = await panXOf(stage)
  await dragStage(page, stage, -160, 28)
  await expect.poll(() => panXOf(stage)).not.toBe(beforeDrag)

  // Arrow keys pan the focused stage; 0 fits the map again.
  await stage.focus()
  const beforeKey = await panXOf(stage)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => panXOf(stage)).not.toBe(beforeKey)
  await page.keyboard.press('0')
  await expect.poll(() => zoomOf(stage)).toBeCloseTo(fitted, 3)
  await page.keyboard.press('+')
  await expect.poll(() => zoomOf(stage)).toBeCloseTo(fitted * 1.5, 3)
  expectNoBrowserErrors(errors)
})

test('hovering a tile describes it, a click pins it, and Escape steps back', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await analyzeSeed(page, 'aaaaaaaaa', 'AAA-AAA-AAA')
  const { dialog, canvas } = await openMap(page, FLOOR_4)
  await waitForCanvasPaint(canvas)

  const details = dialog.getByRole('dialog', { name: 'Tile details' })
  await hoverMapPoint(page, canvas, CRYSTALS.x, CRYSTALS.y)
  await expect(details).toContainText('Energy crystal ×5')
  await expect(details).not.toHaveAttribute('data-pinned')
  await page.mouse.down()
  await page.mouse.up()
  await expect(details).toHaveAttribute('data-pinned', 'true')
  // A pinned panel stays when the pointer leaves the map.
  await page.mouse.move(2, 2)
  await expect(details).toContainText('Energy crystal')

  await page.keyboard.press('Escape')
  await expect(details).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expectNoBrowserErrors(errors)
})

test('the map dialog focuses itself, then Tab reaches the zoom controls', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await analyzeSeed(page, 'aaaaaaaaa', 'AAA-AAA-AAA')
  const { dialog, canvas, trigger } = await openMap(page, FLOOR_4)
  await waitForCanvasPaint(canvas)
  await expect(dialog).toBeFocused()
  const zoomOut = dialog.getByRole('button', { name: 'Zoom map out' })
  await expect(zoomOut).not.toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Close' })).not.toBeFocused()

  await page.keyboard.press('Tab')
  await expect(zoomOut).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    dialog.getByRole('button', { name: 'Zoom map in' })
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByTestId('map-scroll-container')).toBeFocused()

  // The secrets toggle redraws the map with secret rooms and doors.
  const secrets = dialog.getByRole('button', { name: 'Secrets' })
  await secrets.click()
  await expect(secrets).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('data-secrets', 'shown')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  expectNoBrowserErrors(errors)
})
