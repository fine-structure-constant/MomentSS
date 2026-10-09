import { describe, expect, it } from 'vitest'
import { buildStitchLayout, layoutPhotoOverlay, wrapLayoutText, type TextMeasure } from './stitchLayout'
import { createPhotoOverlay, createTextBlock, DEFAULT_SETTINGS } from './defaults'
import { pairPhotoWithNext } from './composer'
import type { PhotoBlock } from '../types'

const photo = (id: string): PhotoBlock => ({ id, type: 'photo', name: id, blob: new Blob(), width: 1200, height: 800 })
const measure: TextMeasure = (text, style) => Array.from(text).length * style.fontSize

describe('shared structured collage layout', () => {
  it('places cropped photos with exactly one gap and two outer paddings', () => {
    const layout = buildStitchLayout([photo('a'), { ...photo('b'), frameHeight: 50 }], { ...DEFAULT_SETTINGS, padding: 40, gap: 20 }, measure)
    expect(layout.items[0]).toMatchObject({ x: 40, y: 40, width: 1000, height: 1000 * 800 / 1200 })
    expect(layout.items[1].y).toBeCloseTo(40 + 1000 * 800 / 1200 + 20)
    expect(layout.height).toBeCloseTo(40 * 2 + 1000 * 800 / 1200 * 1.5 + 20)
    expect(layout.items[1].photos[0].crop.sh).toBeCloseTo(400)
  })

  it('keeps row geometry and each photo crop independent', () => {
    const paired = pairPhotoWithNext([photo('a'), { ...photo('b'), cropZoom: 2 }], 'a')
    const row = { ...paired.row!, gap: 40, heightRatio: 50 }
    const layout = buildStitchLayout([row], DEFAULT_SETTINGS, measure)
    expect(layout.items[0].height).toBe(540)
    const [left, right] = layout.items[0].photos
    expect(left.width).toBe(520)
    expect(right.x).toBe(560)
    expect(right.crop.sw).toBeCloseTo(left.crop.sw / 2)
  })

  it('wraps by Unicode graphemes and preserves empty paragraphs', () => {
    const text = { ...createTextBlock(''), fontSize: 10 }
    expect(wrapLayoutText('海🌊边\n\n旅行', 20, text, measure)).toEqual(['海🌊', '边', '', '旅行'])
  })

  it('measures text height once for both preview and export', () => {
    const text = { ...createTextBlock('abcdef'), fontSize: 100, padding: 40, lineHeight: 1.5 }
    const layout = buildStitchLayout([text], { ...DEFAULT_SETTINGS, width: 400 }, measure)
    expect(layout.items[0].text?.lines).toEqual(['abc', 'def'])
    expect(layout.height).toBe(380)
  })

  it('clamps the whole rotated photo-text box and includes padding in its height', () => {
    const overlay = { ...createPhotoOverlay('旅途'), x: 0, y: 0, width: 0.5, boxPadding: 20, fontSize: 30 }
    const box = layoutPhotoOverlay(overlay, 1000, 600, measure)
    expect(box.x).toBe(250)
    expect(box.y).toBeGreaterThanOrEqual(box.height / 2)
    expect(box.height).toBe(30 * 1.25 + 40)
  })
})
