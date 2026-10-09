import type { ComposerBlock, ComposerSettings, CoverRecipe, ImportedAsset, SavedComposition } from '../types'
import { buildCoverLayout } from './coverLayout'
import { buildStitchLayout, createTextMeasurer, type TextMeasure } from './stitchLayout'
import { canvasToBlob, renderStitch, renderStitchLayout } from './canvas'
import { DEFAULT_SETTINGS } from './defaults'

export function compositionLayout(composition: Pick<SavedComposition, 'blocks' | 'settings' | 'cover'>, measure: TextMeasure) {
  return composition.cover ? buildCoverLayout(composition.blocks, composition.settings, composition.cover, measure).layout
    : buildStitchLayout(composition.blocks, composition.settings, measure)
}

export async function createComposition(name: string, blocks: ComposerBlock[], settings: ComposerSettings, cover?: CoverRecipe): Promise<SavedComposition> {
  const snapshot = structuredClone({ blocks, settings, cover })
  const layout = compositionLayout(snapshot, createTextMeasurer())
  const canvas = document.createElement('canvas')
  await renderStitchLayout(canvas, layout, cover?.background ?? settings.background, Math.min(180, settings.width))
  const thumbnail = await canvasToBlob(canvas, 'image/png')
  return { ...snapshot, id: `composition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name,
    kind: cover ? 'cover' : 'collage', createdAt: Date.now(), width: layout.width, height: layout.height, thumbnail }
}

export async function exportResource(resource: ImportedAsset | SavedComposition, format: 'image/png' | 'image/jpeg') {
  const canvas = document.createElement('canvas')
  const report = 'blocks' in resource
    ? await renderStitchLayout(canvas, compositionLayout(resource, createTextMeasurer()), resource.cover?.background ?? resource.settings.background)
    : await renderStitch(canvas, [resource], { ...DEFAULT_SETTINGS, width: resource.type === 'photo' ? resource.width : 1080 })
  return { blob: await canvasToBlob(canvas, format, 0.94), report }
}

export function resourceFileName(name: string, format: 'image/png' | 'image/jpeg') {
  const base = name.replace(/\.(?:jpe?g|png|webp|avif|svg|heic|heif|hif|heics|heifs)$/i, '').replace(/[\r\n\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'MomentSS'
  return `${base}.${format === 'image/png' ? 'png' : 'jpg'}`
}
