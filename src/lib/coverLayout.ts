import type { ComposerBlock, ComposerSettings, CoverRecipe } from '../types'
import { clamp, computeCropRect } from './geometry'
import { buildStitchLayout, type StitchLayout, type StitchLayoutItem, type TextMeasure } from './stitchLayout'

function boundaryY(layout: StitchLayout, index: number): number {
  if (index === 0) return layout.items[0]?.y ?? 0
  const previous = layout.items[index - 1]
  return previous.y + previous.height
}

export function suggestCoverBoundary(layout: StitchLayout): number {
  let best = 0
  for (let index = 1; index <= layout.items.length; index++) {
    if (Math.abs(boundaryY(layout, index) - layout.height / 2) < Math.abs(boundaryY(layout, best) - layout.height / 2)) best = index
  }
  return best
}

/** Insert between whole layers, then balance outer whitespace around a full-width square cover. */
export function buildCoverLayout(blocks: ComposerBlock[], settings: ComposerSettings, recipe: CoverRecipe, measure: TextMeasure) {
  const base = buildStitchLayout(blocks, settings, measure)
  const insertAt = clamp(Math.round(recipe.insertAt), 0, base.items.length)
  const insertionY = boundaryY(base, insertAt)
  const spacing = Math.max(0, recipe.spacing)
  const topBlank = Math.max(0, base.height - insertionY * 2)
  const bottomBlank = Math.max(0, insertionY * 2 - base.height)
  const insertedHeight = base.width + spacing * 2
  const photo = { ...recipe.photo, id: `cover-${recipe.photo.id}`, cropZoom: recipe.crop.zoom, cropX: recipe.crop.x, cropY: recipe.crop.y }
  const cover: StitchLayoutItem = {
    block: photo, x: 0, y: topBlank + insertionY + spacing, width: base.width, height: base.width,
    photos: [{ photo, x: 0, width: base.width, height: base.width, crop: computeCropRect(photo.width, photo.height, 1, recipe.crop) }],
  }
  const items = base.items.map((item, index) => ({ ...item, y: item.y + topBlank + (index >= insertAt ? insertedHeight : 0) }))
  items.splice(insertAt, 0, cover)
  return { layout: { width: base.width, height: base.height + insertedHeight + topBlank + bottomBlank, items }, topBlank, bottomBlank, coverId: photo.id }
}
