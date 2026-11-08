import { expect, test } from '@playwright/test'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import { snapshotCanvas, waitForCanvasPaint } from './helpers/canvas'
import { analyzeSeed, openMap } from './helpers/map-dialog'
import {
  MAP_FIXTURES,
  mapSnapshotName,
  mapTestName,
} from './helpers/map-fixtures'

// Each registered level, drawn revealed by the real engine and renderer with
// reduced motion (the first animation frame), compared pixel for pixel. The
// concealed overlay that fades over secrets is a separate canvas.
for (const fixture of MAP_FIXTURES) {
  test(mapTestName(fixture), async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await analyzeSeed(page, fixture.typed, fixture.seed)
    const { canvas } = await openMap(page, fixture.level)
    await expect(page.locator('canvas[data-secret-overlay]')).toBeAttached()
    await waitForCanvasPaint(canvas)
    await snapshotCanvas(canvas, mapSnapshotName(fixture))
    expectNoBrowserErrors(errors)
  })
}
