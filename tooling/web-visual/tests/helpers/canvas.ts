import { expect, type Locator } from '@playwright/test'

/** Waits until the canvas has a backing bitmap with at least one painted pixel. */
export async function waitForCanvasPaint(canvas: Locator): Promise<void> {
  await expect(canvas).toBeVisible()
  await expect
    .poll(async () =>
      canvas.evaluate((node) => {
        const element = node as HTMLCanvasElement
        const context = element.getContext('2d')
        if (!context || element.width === 0 || element.height === 0) {
          return false
        }
        const pixels = context.getImageData(
          0,
          0,
          element.width,
          element.height
        ).data
        for (let alpha = 3; alpha < pixels.length; alpha += 4) {
          if (pixels[alpha] !== 0) return true
        }
        return false
      })
    )
    .toBe(true)
}

/**
 * Compares the canvas backing bitmap, pixel for pixel, with a committed
 * snapshot. The bitmap is read after two frames so a pending draw lands, and
 * it is not clipped by the viewport.
 */
export async function snapshotCanvas(
  canvas: Locator,
  snapshot: string
): Promise<void> {
  const dataUrl = await canvas.evaluate(async (node) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    return (node as HTMLCanvasElement).toDataURL('image/png')
  })
  const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  expect(png).toMatchSnapshot(snapshot, { maxDiffPixels: 0, threshold: 0 })
}
