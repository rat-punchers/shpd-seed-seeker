import { expect, type Locator, type Page } from '@playwright/test'
import { openApp } from './app'
import {
  branchQuest,
  type MapLevel,
  mapDialogTitle,
  mapLabel,
} from './map-fixtures'

/** Opens Analyze and analyzes a seed with the real engine. */
export async function analyzeSeed(
  page: Page,
  typed: string,
  seed: string
): Promise<void> {
  await openApp(page)
  const field = page.getByLabel('Enter your seed')
  await field.pressSequentially(typed)
  await expect(field).toHaveValue(seed)
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.locator('[data-seed-title]')).toHaveText(seed)
  await expect(
    page.getByRole('heading', { name: 'Floor 1', exact: true })
  ).toBeVisible({ timeout: 60_000 })
}

export interface OpenedMap {
  dialog: Locator
  canvas: Locator
  stage: Locator
  trigger: Locator
}

/** Clicks a level's map button and waits for the dialog and its canvas. */
export async function openMap(page: Page, level: MapLevel): Promise<OpenedMap> {
  const scope =
    level.kind === 'main'
      ? page.locator(`[data-floor-depth="${level.depth}"]`)
      : page.locator(`[data-quest="${branchQuest(level.objective)}"]`)
  const trigger = scope.getByRole('button', {
    name: `Expand ${mapLabel(level)}`,
    exact: true,
  })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: mapDialogTitle(level) })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('heading', { name: mapDialogTitle(level), exact: true })
  ).toBeVisible()
  const canvas = dialog.getByRole('img', {
    name: /^Shattered Pixel Dungeon floor map/,
  })
  const stage = dialog.getByTestId('map-scroll-container')
  return { dialog, canvas, stage, trigger }
}

export async function zoomOf(stage: Locator): Promise<number> {
  return Number(await stage.getAttribute('data-zoom'))
}

export async function panXOf(stage: Locator): Promise<number> {
  return Number(await stage.getAttribute('data-pan-x'))
}

/** Drags across the middle of the stage with the mouse. */
export async function dragStage(
  page: Page,
  stage: Locator,
  dx: number,
  dy: number
): Promise<void> {
  const box = await stage.boundingBox()
  if (!box) throw new Error('the map stage has no box')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 8 })
  await page.mouse.up()
}

/** Moves the mouse to a map-pixel point of the canvas, as displayed now. */
export async function hoverMapPoint(
  page: Page,
  canvas: Locator,
  mapX: number,
  mapY: number
): Promise<void> {
  const point = await canvas.evaluate(
    (node, [x, y]) => {
      const element = node as HTMLCanvasElement
      const rect = element.getBoundingClientRect()
      return {
        x: rect.left + (x / element.width) * rect.width,
        y: rect.top + (y / element.height) * rect.height,
      }
    },
    [mapX, mapY] as const
  )
  await page.mouse.move(point.x, point.y)
}
