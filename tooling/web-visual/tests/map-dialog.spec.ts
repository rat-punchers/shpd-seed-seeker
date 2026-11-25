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
const IMP_VAULT = {
  kind: 'branch',
  depth: 19,
  branch: 1,
  objective: 'Vault',
} as const
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

test('the map dialog focuses itself, then Tab reaches the header and zoom controls', async ({
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

  for (const name of ['Previous map', 'Next map', 'Close']) {
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name })).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(zoomOut).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    dialog.getByRole('button', { name: 'Zoom map in' })
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByTestId('map-scroll-container')).toBeFocused()

  // Secrets fade in and out over the map instead of behind a toggle.
  await expect(dialog.getByRole('button', { name: 'Secrets' })).toHaveCount(0)
  const overlays = dialog.locator('canvas[data-secret-overlay]')
  await expect(overlays.first()).toBeAttached()
  // Concealment repacks the actor layers on this floor. The shared
  // background layers should still stay outside the overlay crops.
  const overlayPixels = await overlays.evaluateAll((nodes) =>
    (nodes as HTMLCanvasElement[]).reduce(
      (total, crop) => total + crop.width * crop.height,
      0
    )
  )
  const mapPixels = await canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement
    return element.width * element.height
  })
  expect(overlayPixels).toBeLessThan(mapPixels / 4)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  expectNoBrowserErrors(errors)
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 1200 },
]) {
  test(`the map dialog browses adjacent floor and quest maps at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const errors = collectBrowserErrors(page)
    await page.goto('/analyze?seed=AAA-AAA-AAA')
    const { canvas, trigger } = await openMap(page, IMP_VAULT)
    await waitForCanvasPaint(canvas)
    const dialog = page.locator('[data-slot="dialog-content"]')
    const title = dialog.getByRole('heading')
    const prev = dialog.getByRole('button', { name: 'Previous map' })
    const next = dialog.getByRole('button', { name: 'Next map' })
    const close = dialog.getByRole('button', { name: 'Close', exact: true })

    await expect(title).toHaveText('Imp Vault - Floor 19')
    await expect(
      dialog.locator('[data-slot="dialog-description"]')
    ).toHaveCount(0)
    const [heading, previous, following, dismiss] = await Promise.all([
      title.boundingBox(),
      prev.boundingBox(),
      next.boundingBox(),
      close.boundingBox(),
    ])
    if (!heading || !previous || !following || !dismiss)
      throw new Error('Missing map header controls')
    expect(heading.x + heading.width).toBeLessThanOrEqual(previous.x)
    expect(previous.x + previous.width).toBeLessThanOrEqual(following.x)
    expect(following.x + following.width).toBeLessThanOrEqual(dismiss.x)
    expect(dismiss.x + dismiss.width).toBeLessThan(viewport.width)

    await prev.click()
    await expect(title).toHaveText('Floor 19')
    await waitForCanvasPaint(
      dialog.getByRole('img', {
        name: 'Shattered Pixel Dungeon floor map, Floor 19',
      })
    )
    await expect(prev).toBeFocused()
    await next.click()
    await expect(title).toHaveText('Imp Vault - Floor 19')
    await next.click()
    await expect(title).toHaveText('Floor 21')
    for (const depth of [22, 23, 24]) {
      await next.click()
      await expect(title).toHaveText(`Floor ${depth}`)
    }
    await expect(next).toBeDisabled()
    await close.click()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(title).toHaveText('Imp Vault - Floor 19')
    await close.click()
    const first = await openMap(page, { kind: 'main', depth: 1 })
    await expect(
      first.dialog.getByRole('button', { name: 'Previous map' })
    ).toBeDisabled()
    expectNoBrowserErrors(errors)
  })
}

test('the map header shows the floor feeling, boss and active trinket', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = collectBrowserErrors(page)
  await page.goto('/analyze?seed=AAA-AAA-AAA')
  const band = page.locator('[data-trinket-choice]')
  await band.getByRole('radio', { name: 'Mimic Tooth' }).click()
  await expect(band).toContainText('Floors 5+ are generated with Mimic Tooth.')
  await openMap(page, FLOOR_4)
  const header = page.locator('[data-slot="dialog-header"]')
  const water = header.getByRole('img', { name: 'Water floor' })
  await expect(water).toHaveCSS('background-position', '-64px -128px')
  const titleRow = header.getByRole('heading').locator('..')
  await expect(titleRow.locator('span[style*="icons-"]')).toHaveCount(1)
  await expect(titleRow.locator('[data-feeling]:first-child')).toBeVisible()
  const trinket = header.getByRole('img', {
    name: 'Generated with Mimic Tooth',
  })
  await expect(trinket).toHaveCount(0)
  await header.getByRole('button', { name: 'Next map' }).click()
  await expect(header.getByRole('heading')).toHaveText('Floor 5')
  await expect(header.getByRole('img', { name: 'Boss: Goo' })).toBeVisible()
  await expect(trinket).toBeVisible()
  await expect(header.locator('[data-feeling]')).toHaveCount(0)
  await header.getByRole('button', { name: 'Previous map' }).click()
  await expect(header.getByRole('img', { name: 'Water floor' })).toBeVisible()
  await expect(header.getByRole('img', { name: 'Boss: Goo' })).toHaveCount(0)
  expectNoBrowserErrors(errors)
})
