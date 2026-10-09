import type { ComposerBlock, PhotoBlock, PhotoRowBlock, TextBlock } from '../types'
import { clamp } from './geometry'

export type ComposerAsset = PhotoBlock | TextBlock

export function flattenComposerAssets(blocks: ComposerBlock[]): ComposerAsset[] {
  return blocks.flatMap((block) => block.type === 'photo-row' ? block.photos : [block])
}

export function findComposerAsset(blocks: ComposerBlock[], id: string | null): ComposerAsset | null {
  if (!id) return null
  for (const block of blocks) {
    if (block.type === 'photo-row') {
      const photo = block.photos.find((item) => item.id === id)
      if (photo) return photo
    } else if (block.id === id) {
      return block
    }
  }
  return null
}

export function findPhotoRow(blocks: ComposerBlock[], photoId: string | null): PhotoRowBlock | null {
  if (!photoId) return null
  return blocks.find((block): block is PhotoRowBlock => block.type === 'photo-row' && (block.id === photoId || block.photos.some((photo) => photo.id === photoId))) ?? null
}

export function updatePhotoInBlocks(
  blocks: ComposerBlock[],
  photoId: string,
  patch: Partial<PhotoBlock>,
): ComposerBlock[] {
  return blocks.map((block) => {
    if (block.type === 'photo' && block.id === photoId) return { ...block, ...patch, type: 'photo' }
    if (block.type !== 'photo-row') return block
    const photos = block.photos.map((photo) => photo.id === photoId ? { ...photo, ...patch, type: 'photo' as const } : photo) as [PhotoBlock, PhotoBlock]
    return { ...block, photos }
  })
}

export function removeAssetFromBlocks(blocks: ComposerBlock[], assetId: string): ComposerBlock[] {
  return blocks.flatMap((block): ComposerBlock[] => {
    if (block.type === 'photo-row') {
      const remaining = block.photos.filter((photo) => photo.id !== assetId)
      if (remaining.length === 1) return remaining
      return [block]
    }
    return block.id === assetId ? [] : [block]
  })
}

/**
 * Pairs a standalone photo with the layer directly beneath it. Only downward adjacency
 * counts, so the row lands exactly where the two layers already were and nothing else moves.
 */
export function pairPhotoWithNext(
  blocks: ComposerBlock[],
  photoId: string,
): { blocks: ComposerBlock[]; row: PhotoRowBlock | null } {
  const index = blocks.findIndex((block) => block.type === 'photo' && block.id === photoId)
  const first = index >= 0 ? blocks[index] : undefined
  const below = index >= 0 ? blocks[index + 1] : undefined
  if (!first || first.type !== 'photo' || !below || below.type !== 'photo') return { blocks, row: null }

  const row: PhotoRowBlock = {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'photo-row',
    photos: [first, below],
    heightRatio: suggestRowHeightRatio([first, below]),
    gap: 0,
  }
  const next = [...blocks]
  next.splice(index, 2, row)
  return { blocks: next, row }
}

export function splitPhotoRow(blocks: ComposerBlock[], rowId: string): ComposerBlock[] {
  return blocks.flatMap((block) => block.type === 'photo-row' && block.id === rowId ? block.photos : [block])
}

/** Row height that keeps both photos close to their natural shape instead of a fixed 62%. */
export function suggestRowHeightRatio(photos: Array<Pick<PhotoBlock, 'width' | 'height'>>): number {
  if (!photos.length) return 62
  const aspect = photos.reduce((sum, photo) => sum + (photo.height > 0 ? photo.width / photo.height : 1), 0) / photos.length
  return clamp(Math.round(50 / Math.max(0.1, aspect)), 35, 100)
}

export function swapRowPhotos(blocks: ComposerBlock[], rowId: string): ComposerBlock[] {
  return blocks.map((block) => block.type === 'photo-row' && block.id === rowId
    ? { ...block, photos: [block.photos[1], block.photos[0]] as [PhotoBlock, PhotoBlock] }
    : block)
}

export function moveBlockToEdge(blocks: ComposerBlock[], blockId: string, edge: 'start' | 'end'): ComposerBlock[] {
  const index = blocks.findIndex((block) => block.id === blockId)
  if (index < 0) return blocks
  const target = edge === 'start' ? 0 : blocks.length - 1
  if (index === target) return blocks
  const next = [...blocks]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

/** Appends when the anchor is unknown, so "insert" always has a defined result. */
export function insertBlockAfter(blocks: ComposerBlock[], anchorId: string | null, block: ComposerBlock): ComposerBlock[] {
  const index = anchorId ? blocks.findIndex((item) => item.id === anchorId) : -1
  if (index < 0) return [...blocks, block]
  const next = [...blocks]
  next.splice(index + 1, 0, block)
  return next
}

/** Keeps placed layers in sync when a resource is renamed from the library. */
export function renamePhotosInBlocks(blocks: ComposerBlock[], sourceId: string, name: string): ComposerBlock[] {
  const rename = (photo: PhotoBlock): PhotoBlock => (photo.sourceId ?? photo.id) === sourceId ? { ...photo, name } : photo
  return blocks.map((block) => {
    if (block.type === 'photo') return rename(block)
    if (block.type !== 'photo-row') return block
    return { ...block, photos: block.photos.map(rename) as [PhotoBlock, PhotoBlock] }
  })
}
