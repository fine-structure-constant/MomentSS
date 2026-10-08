import type { ComposerBlock, PhotoBlock, PhotoRowBlock, TextBlock } from '../types'

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

export function pairPhotoWithNeighbor(
  blocks: ComposerBlock[],
  photoId: string,
): { blocks: ComposerBlock[]; row: PhotoRowBlock | null } {
  const index = blocks.findIndex((block) => block.type === 'photo' && block.id === photoId)
  if (index < 0) return { blocks, row: null }
  const neighborIndex = blocks[index + 1]?.type === 'photo'
    ? index + 1
    : blocks[index - 1]?.type === 'photo'
      ? index - 1
      : -1
  if (neighborIndex < 0) return { blocks, row: null }

  const firstIndex = Math.min(index, neighborIndex)
  const secondIndex = Math.max(index, neighborIndex)
  const first = blocks[firstIndex]
  const second = blocks[secondIndex]
  if (first.type !== 'photo' || second.type !== 'photo') return { blocks, row: null }

  const row: PhotoRowBlock = {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'photo-row',
    photos: [first, second],
    heightRatio: 62,
    gap: 0,
  }
  const next = [...blocks]
  next.splice(firstIndex, 2, row)
  return { blocks: next, row }
}

export function splitPhotoRow(blocks: ComposerBlock[], rowId: string): ComposerBlock[] {
  return blocks.flatMap((block) => block.type === 'photo-row' && block.id === rowId ? block.photos : [block])
}
