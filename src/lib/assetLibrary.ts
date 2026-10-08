import type { ComposerBlock, ImportedAsset } from '../types'
import { flattenComposerAssets } from './composer'

export function createLayerFromAsset(asset: ImportedAsset): ImportedAsset {
  const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return asset.type === 'photo'
    ? { ...asset, id, sourceId: asset.id, overlay: asset.overlay ? { ...asset.overlay } : undefined }
    : { ...asset, id, sourceId: asset.id }
}

/** The last edited layer becomes the reusable template; other placed copies stay independent. */
export function saveEditedAsset(assets: ImportedAsset[], layer: ImportedAsset): ImportedAsset[] {
  const sourceId = layer.sourceId ?? layer.id
  return assets.map((asset) => {
    // Removing an attachment is intentional: later layer edits must not recreate it.
    if (asset.id !== sourceId || asset.type !== layer.type) return asset
    const template = { ...layer, id: asset.id, sourceId: undefined }
    return template.type === 'photo'
      ? { ...template, overlay: template.overlay ? { ...template.overlay } : undefined }
      : template
  })
}

function assetContent(asset: ImportedAsset): string {
  return JSON.stringify(asset, (key, value: unknown) => {
    if (key === 'id' || key === 'sourceId' || key === 'blob') return undefined
    // Normalize object key order so equivalent legacy records are not treated as edits.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    }
    return value
  })
}

/** One-time repair for drafts saved before layer edits were synchronized to resources. */
export function recoverEditedAssets(assets: ImportedAsset[], blocks: ComposerBlock[]): ImportedAsset[] {
  const originals = new Map(assets.map((asset) => [asset.id, asset]))
  return flattenComposerAssets(blocks).reduce((recovered, layer) => {
    const original = originals.get(layer.sourceId ?? layer.id)
    // An untouched duplicate must not overwrite an edited copy during recovery.
    // Old drafts lack edit timestamps; if several copies differ, the last in canvas order wins.
    return original && original.type === layer.type && assetContent(original) !== assetContent(layer)
      ? saveEditedAsset(recovered, layer)
      : recovered
  }, assets)
}

/** Recover the library once when upgrading drafts that predate independent assets. */
export function recoverImportedAssets(blocks: ComposerBlock[]): ImportedAsset[] {
  const assets = new Map<string, ImportedAsset>()
  flattenComposerAssets(blocks).forEach((block) => {
    const id = block.sourceId ?? block.id
    if (!assets.has(id)) assets.set(id, { ...block, id, sourceId: undefined })
  })
  return [...assets.values()]
}
