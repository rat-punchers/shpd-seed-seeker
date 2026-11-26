import { expect, test } from '@playwright/test'
import {
  collectBrowserErrors,
  expectNoBrowserErrors,
} from './helpers/browser-errors'
import { snapshotCanvas, waitForCanvasPaint } from './helpers/canvas'
import { hoverMapPoint, openMap, panXOf, zoomOf } from './helpers/map-dialog'

const vault = {
  kind: 'branch',
  depth: 19,
  branch: 1,
  objective: 'Vault',
} as const

test.describe('touch maps', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'no-preference',
  })

  test('the Imp Vault keeps its painted effects through zoom and drag', async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page)
    await page.addInitScript(() => {
      const BrowserWorker = window.Worker
      window.Worker = class extends BrowserWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options)
          if (!String(url).includes('/render-worker-')) return
          this.addEventListener('message', ({ data }) => {
            if (data.kind !== 'frame') return
            const hasBitmap = Object.values(data).some(
              (value) => value instanceof ImageBitmap
            )
            const root = document.documentElement
            if (hasBitmap) root.dataset.mapBitmapReply = 'true'
            root.dataset.mapWorkerFrames = String(
              Number(root.dataset.mapWorkerFrames ?? 0) + 1
            )
          })
        }
      }
    })
    await page.goto('/analyze?seed=AAA-AAA-AAA')
    const { canvas, dialog, stage } = await openMap(page, vault)
    await waitForCanvasPaint(canvas)
    await expect(dialog.locator('canvas[data-secret-overlay]')).toHaveCount(0)
    const effects = dialog.locator('canvas[data-map-effects]:visible')
    await expect(effects).toBeVisible()
    const frameCount = async () =>
      Number(await page.locator('html').getAttribute('data-map-worker-frames'))
    expect(await frameCount()).toBeGreaterThan(0)
    const fitted = await zoomOf(stage)
    const zoomIn = dialog.getByRole('button', { name: 'Zoom map in' })
    const cdp = await page.context().newCDPSession(page)
    const box = await stage.boundingBox()
    if (!box) throw new Error('Missing map stage')
    const x = Math.round(box.x + box.width / 2)
    const y = Math.round(box.y + box.height / 2)
    const pinch = (distance: number) => [
      { x: x - distance, y, id: 1 },
      { x: x + distance, y, id: 2 },
    ]
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: pinch(20),
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pinch(100),
    })
    await expect.poll(() => zoomOf(stage)).toBeGreaterThan(fitted)
    await expect(effects).toBeVisible()
    const pinching = await frameCount()
    await page.waitForTimeout(150)
    expect(await frameCount()).toBeLessThanOrEqual(pinching + 1)
    await expect(effects).toBeVisible()
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect.poll(frameCount).toBeGreaterThan(pinching + 1)

    while ((await zoomIn.getAttribute('aria-disabled')) !== 'true')
      await zoomIn.tap()
    await expect(effects).toBeVisible()
    const mapWidth = await canvas.evaluate(
      (node) => (node as HTMLCanvasElement).width
    )
    const effectsWidth = () =>
      effects.evaluate((node) => (node as HTMLCanvasElement).width)
    await expect.poll(effectsWidth).toBeLessThan(mapWidth)
    // At 8× zoom and the 4× density cap, backing pixels are half the CSS width.
    await expect
      .poll(() =>
        effects.evaluate((node) =>
          Math.abs(
            (node as HTMLCanvasElement).width * 2 -
              node.getBoundingClientRect().width
          )
        )
      )
      .toBeLessThan(1)

    const beforeDrag = await panXOf(stage)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - 90, y, id: 1 }],
    })
    await expect.poll(() => panXOf(stage)).not.toBe(beforeDrag)
    await expect(effects).toBeVisible()
    const dragging = await frameCount()
    await page.waitForTimeout(150)
    expect(await frameCount()).toBeLessThanOrEqual(dragging + 1)
    await expect(effects).toBeVisible()
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect.poll(frameCount).toBeGreaterThan(dragging + 1)

    // Wheel zoom can also trigger a new crop. The painted surface stays
    // visible even when input comes in faster than worker frames.
    const dropped = await dialog.evaluate(
      async (node, point) => {
        const stage = node.querySelector('[data-testid="map-scroll-container"]')
        let missing = 0
        for (let step = 0; step < 12; step++) {
          stage?.dispatchEvent(
            new WheelEvent('wheel', {
              clientX: point.x,
              clientY: point.y,
              deltaY: 120,
              bubbles: true,
              cancelable: true,
            })
          )
          await new Promise(requestAnimationFrame)
          if (
            !Array.from(node.querySelectorAll('[data-map-effects]')).some(
              (layer) => getComputedStyle(layer).visibility === 'visible'
            )
          )
            missing++
        }
        return missing
      },
      { x, y }
    )
    expect(dropped).toBe(0)
    await waitForCanvasPaint(canvas)
    expect(
      await page.locator('html').getAttribute('data-map-bitmap-reply')
    ).toBeNull()
    expectNoBrowserErrors(errors)
  })
})

test('a render worker failure restores a painted map in reduced motion', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page)
  await page.addInitScript(() => {
    const BrowserWorker = window.Worker
    window.Worker = class extends BrowserWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        if (String(url).includes('/render-worker-'))
          window.addEventListener(
            'fail-render-worker',
            () =>
              this.dispatchEvent(new ErrorEvent('error', { cancelable: true })),
            { once: true }
          )
      }
    }
  })
  await page.goto('/analyze?seed=AAA-AAA-AAA')
  const { canvas, dialog, trigger } = await openMap(page, vault)
  await waitForCanvasPaint(canvas)
  const transferred = await canvas.elementHandle()
  await page.evaluate(() =>
    window.dispatchEvent(new Event('fail-render-worker'))
  )
  await expect
    .poll(() => transferred?.evaluate((node) => node.isConnected))
    .toBe(false)
  await waitForCanvasPaint(canvas)
  await snapshotCanvas(canvas, 'AAA-AAA-AAA-F19-B1-Vault.png')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(trigger).toBeFocused()
  expectNoBrowserErrors(errors)
})

test('inspecting a secret tile clears its concealed overlay and restores it on leave', async ({
  page,
}) => {
  await page.goto('/analyze?seed=AAA-AAA-AAA')
  const { canvas, dialog } = await openMap(page, { kind: 'main', depth: 2 })
  await waitForCanvasPaint(canvas)
  // Cell 115 contains a concealed Golden key on the 35-column floor.
  const [x, y] = [10 * 16, 3 * 16]
  const overlays = dialog.locator('canvas[data-secret-overlay]')
  expect(await overlays.count()).toBeGreaterThan(1)
  const alpha = () =>
    overlays.evaluateAll(
      (nodes, [x, y]) => {
        for (const node of nodes as HTMLCanvasElement[]) {
          const localX = x - parseFloat(node.style.left)
          const localY = y - parseFloat(node.style.top)
          if (
            localX < 0 ||
            localY < 0 ||
            localX >= node.width ||
            localY >= node.height
          ) {
            continue
          }
          const ctx = node.getContext('2d')
          const data = ctx?.getImageData(localX, localY, 16, 16).data
          if (data?.some((value, index) => index % 4 === 3 && value > 0))
            return true
        }
        return false
      },
      [x, y] as const
    )
  const mapPixels = await canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement
    return element.width * element.height
  })
  const overlayPixels = await overlays.evaluateAll((nodes) =>
    (nodes as HTMLCanvasElement[]).reduce(
      (total, element) => total + element.width * element.height,
      0
    )
  )
  expect(overlayPixels).toBeLessThan(mapPixels / 4)
  await expect.poll(alpha).toBe(true)
  await hoverMapPoint(page, canvas, x + 8, y + 3)
  await expect(
    dialog.getByRole('dialog', { name: 'Tile details' })
  ).toContainText('Golden key')
  await expect.poll(alpha).toBe(false)
  await dialog.getByRole('button', { name: 'Close' }).hover()
  await expect.poll(alpha).toBe(true)
})
