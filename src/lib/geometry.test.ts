import { describe, expect, it } from 'vitest'
import { computeCropRect, cropPanRoom, fitCanvasSize, gridDimensions, photoFrameAspect, resolvePhotoOverlayLayout } from './geometry'

describe('computeCropRect', () => {
  it('centers a square inside a landscape source', () => {
    expect(computeCropRect(1600, 900, 1, { zoom: 1, x: 0, y: 0 })).toEqual({
      sx: 350,
      sy: 0,
      sw: 900,
      sh: 900,
    })
  })

  it('moves a zoomed crop without leaving the source', () => {
    const crop = computeCropRect(1000, 1000, 1, { zoom: 2, x: 1, y: -1 })
    expect(crop).toEqual({ sx: 500, sy: 0, sw: 500, sh: 500 })
  })
})

describe('gridDimensions', () => {
  it.each([
    [4, 2, 2],
    [6, 3, 2],
    [9, 3, 3],
  ] as const)('maps %i tiles to %ix%i', (count, columns, rows) => {
    expect(gridDimensions(count)).toEqual({ columns, rows })
  })
})

describe('fitCanvasSize', () => {
  it('keeps safe images unchanged', () => {
    expect(fitCanvasSize(1080, 5000).reduced).toBe(false)
  })

  it('reduces images that exceed the maximum edge', () => {
    const result = fitCanvasSize(1080, 32_000)
    expect(result.height).toBeLessThanOrEqual(16_000)
    expect(result.reduced).toBe(true)
  })
})

describe('resolvePhotoOverlayLayout', () => {
  it('migrates legacy top/center/bottom positions', () => {
    expect(resolvePhotoOverlayLayout({ position: 'top' }).y).toBe(0.18)
    expect(resolvePhotoOverlayLayout({ position: 'center' }).y).toBe(0.5)
    expect(resolvePhotoOverlayLayout({ position: 'bottom' }).y).toBe(0.78)
  })

  it('keeps a wide text box inside the photo', () => {
    expect(resolvePhotoOverlayLayout({ x: 0.02, y: 2, width: 0.8 })).toEqual({
      x: 0.4,
      y: 0.94,
      width: 0.8,
    })
  })
})

describe('cropPanRoom', () => {
  it('reports the axis that is already flush at the minimum zoom', () => {
    expect(cropPanRoom(1600, 900, 1, { zoom: 1, x: 0, y: 0 })).toEqual({ x: true, y: false })
    expect(cropPanRoom(900, 1600, 1, { zoom: 1, x: 0, y: 0 })).toEqual({ x: false, y: true })
  })

  it('reports no room at all when the source already matches the frame', () => {
    expect(cropPanRoom(1000, 1000, 1, { zoom: 1, x: 0, y: 0 })).toEqual({ x: false, y: false })
  })

  it('opens both axes once the crop is zoomed in', () => {
    expect(cropPanRoom(1600, 900, 1, { zoom: 2, x: 0, y: 0 })).toEqual({ x: true, y: true })
  })
})

describe('photoFrameAspect', () => {
  it('narrows the frame as the container height shrinks', () => {
    expect(photoFrameAspect({ width: 1200, height: 800 })).toBeCloseTo(1.5)
    expect(photoFrameAspect({ width: 1200, height: 800, frameHeight: 150 })).toBeCloseTo(1)
  })
})
