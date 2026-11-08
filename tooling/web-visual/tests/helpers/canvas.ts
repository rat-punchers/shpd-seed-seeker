import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { expect, type Locator, test } from '@playwright/test'

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
 * Chromium on macOS arm64 and Linux x86-64 round alpha blending differently,
 * by at most 2 of 255 per channel. A moved or recolored sprite differs by far
 * more.
 */
export const MAX_CHANNEL_DELTA = 2

/**
 * Compares the canvas backing bitmap, pixel for pixel, with a committed
 * snapshot, allowing `MAX_CHANNEL_DELTA` per channel. The bitmap is read
 * after two frames so a pending draw lands, and it is not clipped by the
 * viewport. Anything else (a mismatch, a missing snapshot, an update run)
 * goes through the exact `toMatchSnapshot`, which writes the diff images.
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
  const info = test.info()
  const path = info.snapshotPath(snapshot)
  if (info.config.updateSnapshots !== 'all' && existsSync(path)) {
    const expected = (await readFile(path)).toString('base64')
    const close = await canvas.evaluate(
      async (_node, [actual, committed, tolerance]) => {
        const pixels = async (base64: string) => {
          const image = new Image()
          image.src = `data:image/png;base64,${base64}`
          await image.decode()
          const bitmap = new OffscreenCanvas(image.width, image.height)
          const context = bitmap.getContext(
            '2d'
          ) as OffscreenCanvasRenderingContext2D
          context.drawImage(image, 0, 0)
          return context.getImageData(0, 0, image.width, image.height)
        }
        const a = await pixels(actual as string)
        const b = await pixels(committed as string)
        if (a.width !== b.width || a.height !== b.height) return false
        for (let i = 0; i < a.data.length; i++) {
          if (
            Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0)) >
            (tolerance as number)
          )
            return false
        }
        return true
      },
      [dataUrl.slice(dataUrl.indexOf(',') + 1), expected, MAX_CHANNEL_DELTA]
    )
    if (close) return
  }
  expect(png).toMatchSnapshot(snapshot, { maxDiffPixels: 0, threshold: 0 })
}
