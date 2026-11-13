import { describe, expect, it } from 'bun:test'
import {
  applyZoom,
  clampPan,
  layoutMapView,
  MAX_TILE_CSS,
  type MapMetrics,
  panBy,
  TILE_PX,
  wheelZoomFactor,
} from '../../../src/features/level-map/map-view'

// A 40×30-tile map in a 1000×600 stage.
const content = { contentWidth: 40 * TILE_PX, contentHeight: 30 * TILE_PX }
const fitted = layoutMapView({
  width: 1000,
  height: 600,
  ...content,
  rasterScale: 1,
  previous: null,
})
const metrics: MapMetrics = {
  width: 1000,
  height: 600,
  ...content,
  minZoom: fitted.minZoom,
  maxZoom: fitted.maxZoom,
}

describe('map view', () => {
  it('fits and centres a new stage, with the fit as the smallest zoom', () => {
    // Height limits: (600 - 32) / 480.
    expect(fitted.view.zoom).toBeCloseTo(568 / 480)
    expect(fitted.minZoom).toBe(fitted.view.zoom)
    expect(fitted.maxZoom).toBe(MAX_TILE_CSS / TILE_PX)
    expect(fitted.view.x).toBeCloseTo((1000 - 640 * fitted.view.zoom) / 2)
    expect(fitted.view.y).toBeCloseTo(16)
  })

  it('keeps the previous zoom across a resize, inside the new bounds', () => {
    const zoomed = { zoom: 4, x: -300, y: -200 }
    const resized = layoutMapView({
      width: 800,
      height: 500,
      ...content,
      rasterScale: 1,
      previous: zoomed,
    })
    expect(resized.view.zoom).toBe(4)
    expect(resized.view.x).toBe(-300)
    expect(resized.view.y).toBe(-200)
  })

  it('zooms about the anchor and clamps to the zoom bounds', () => {
    const anchorX = 300
    const anchorY = 200
    const zoomed = applyZoom(fitted, metrics, 2, anchorX, anchorY)
    if (!zoomed) throw new Error('no frame')
    expect(zoomed.view.zoom).toBeCloseTo(fitted.view.zoom * 2)
    // The map point under the anchor stays under it.
    const before = (anchorX - fitted.view.x) / fitted.view.zoom
    const after = (anchorX - zoomed.view.x) / zoomed.view.zoom
    expect(after).toBeCloseTo(before)
    expect(applyZoom(fitted, metrics, 1000, 0, 0)?.view.zoom).toBe(
      metrics.maxZoom
    )
    expect(applyZoom(zoomed, metrics, 0, 0, 0)?.view).toEqual(fitted.view)
  })

  it('pans a large map until a margin shows, and centres a small one', () => {
    const zoomed = applyZoom(fitted, metrics, 4, 500, 300)
    const far = panBy(zoomed, metrics, 100_000, 100_000)
    expect(far?.view.x).toBe(48)
    expect(far?.view.y).toBe(48)
    expect(panBy(fitted, metrics, 100, 0)?.view.x).toBeCloseTo(fitted.view.x)
    expect(clampPan({ zoom: 0.5, x: 0, y: 0 }, 1000, 600, 640, 480)).toEqual({
      zoom: 0.5,
      x: 340,
      y: 180,
    })
  })

  it('normalizes line and page wheel deltas', () => {
    const pixels = wheelZoomFactor({ deltaY: 16, deltaMode: 0, pageHeight: 1 })
    expect(wheelZoomFactor({ deltaY: 1, deltaMode: 1, pageHeight: 1 })).toBe(
      pixels
    )
    expect(wheelZoomFactor({ deltaY: 1, deltaMode: 2, pageHeight: 16 })).toBe(
      pixels
    )
    expect(
      wheelZoomFactor({ deltaY: -100, deltaMode: 0, pageHeight: 1 })
    ).toBeCloseTo(
      1 / wheelZoomFactor({ deltaY: 100, deltaMode: 0, pageHeight: 1 })
    )
  })
})
