import { describe, expect, it } from 'vitest'
import { buildCoverLayout, suggestCoverBoundary } from './coverLayout'
import { buildStitchLayout } from './stitchLayout'
import { DEFAULT_SETTINGS, createTextBlock } from './defaults'
import type { ComposerBlock, CoverRecipe, PhotoBlock } from '../types'

const photo = (id: string, width = 1200, height = 800): PhotoBlock => ({ id, type: 'photo', name: id, blob: new Blob(), width, height })
const measure = (text: string) => text.length * 30
const blocks: ComposerBlock[] = [photo('first'), { id: 'pair', type: 'photo-row', photos: [photo('left'), photo('right')], heightRatio: 72, gap: 20 }, createTextBlock('一段完整的旅行记录'), photo('last', 900, 1600)]
const recipe: CoverRecipe = { photo: photo('cover-source', 1500, 1000), crop: { zoom: 1.5, x: 0.25, y: -0.5 }, insertAt: 2, spacing: 80, background: '#ffffff' }

describe('cover insertion into a structured collage', () => {
  it('keeps the full-width cover exactly inside the center-square crop at every boundary', () => {
    const settings = { ...DEFAULT_SETTINGS, padding: 36, gap: 22 }
    for (let index = 0; index <= blocks.length; index++) {
      const { layout, coverId } = buildCoverLayout(blocks, settings, { ...recipe, insertAt: index }, measure)
      const cover = layout.items.find((item) => item.block.id === coverId)!
      expect(cover.y).toBeCloseTo((layout.height - layout.width) / 2)
      expect(cover.x).toBe(0)
      expect(cover.width).toBe(layout.width)
      expect(cover.height).toBe(layout.width)
    }
  })

  it('preserves complete layer geometry, crops and order without cutting photos or rows', () => {
    const base = buildStitchLayout(blocks, DEFAULT_SETTINGS, measure)
    const { layout } = buildCoverLayout(blocks, DEFAULT_SETTINGS, recipe, measure)
    expect(layout.items.map((item) => item.block.id)).toEqual([blocks[0].id, blocks[1].id, `cover-${recipe.photo.id}`, blocks[2].id, blocks[3].id])
    for (const original of base.items) {
      const placed = layout.items.find((item) => item.block.id === original.block.id)!
      expect(placed.block).toBe(original.block)
      expect(placed.height).toBe(original.height)
      expect(placed.width).toBe(original.width)
      expect(placed.photos).toEqual(original.photos)
      expect(placed.text).toEqual(original.text)
    }
    expect(blocks).toHaveLength(4)
    expect(recipe.photo.cropZoom).toBeUndefined()
  })

  it('adds the required outer whitespace at the top or bottom for extreme insertions', () => {
    const base = buildStitchLayout(blocks, DEFAULT_SETTINGS, measure)
    const first = buildCoverLayout(blocks, DEFAULT_SETTINGS, { ...recipe, insertAt: 0 }, measure)
    const last = buildCoverLayout(blocks, DEFAULT_SETTINGS, { ...recipe, insertAt: blocks.length }, measure)
    expect(first.topBlank).toBeCloseTo(base.height)
    expect(first.bottomBlank).toBe(0)
    expect(last.bottomBlank).toBeCloseTo(base.height)
    expect(last.topBlank).toBe(0)
  })

  it('suggests a boundary with minimal outer padding and retains user crop parameters', () => {
    const symmetric = [photo('a', 1000, 1000), photo('b', 1000, 1000)]
    expect(suggestCoverBoundary(buildStitchLayout(symmetric, DEFAULT_SETTINGS, measure))).toBe(1)
    const result = buildCoverLayout(symmetric, DEFAULT_SETTINGS, { ...recipe, insertAt: 1 }, measure)
    expect(result.topBlank + result.bottomBlank).toBe(0)
    const placement = result.layout.items[1].photos[0]
    expect(placement.photo).toMatchObject({ cropZoom: 1.5, cropX: 0.25, cropY: -0.5 })
    expect(placement.crop.sw).toBeCloseTo(recipe.photo.height / recipe.crop.zoom)
  })

  it('preserves centering as symmetric spacing changes', () => {
    const first = buildCoverLayout(blocks, DEFAULT_SETTINGS, { ...recipe, spacing: 0 }, measure)
    const spaced = buildCoverLayout(blocks, DEFAULT_SETTINGS, { ...recipe, spacing: 120 }, measure)
    expect(spaced.layout.height - first.layout.height).toBe(240)
    expect(spaced.topBlank).toBe(first.topBlank)
    expect(spaced.bottomBlank).toBe(first.bottomBlank)
    const cover = spaced.layout.items.find((item) => item.block.id === spaced.coverId)!
    expect(cover.y + cover.height / 2).toBeCloseTo(spaced.layout.height / 2)
  })
})
