import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { expect, type Locator, test } from '@playwright/test'

/** Waits for the map's opaque background without taking ownership of the canvas. */
export async function waitForCanvasPaint(canvas: Locator): Promise<void> {
  await expect(canvas).toBeVisible()
  await expect
    .poll(async () =>
      canvas.evaluate((node) => {
        const element = node as HTMLCanvasElement
        if (element.width === 0 || element.height === 0) return false
        const scratch = new OffscreenCanvas(1, 1)
        const context = scratch.getContext('2d')
        if (!context) return false
        context.drawImage(element, 0, 0, 1, 1, 0, 0, 1, 1)
        return context.getImageData(0, 0, 1, 1).data[3] === 255
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

export async function canvasDataUrl(canvas: Locator): Promise<string> {
  return canvas.evaluate(async (node) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    const source = node as HTMLCanvasElement
    const scratch = document.createElement('canvas')
    scratch.width = source.width
    scratch.height = source.height
    scratch.getContext('2d')?.drawImage(source, 0, 0)
    return scratch.toDataURL('image/png')
  })
}

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
  const dataUrl = await canvasDataUrl(canvas)
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
