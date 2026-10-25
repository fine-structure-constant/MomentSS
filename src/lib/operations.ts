import type { ComposerBlock, PhotoRowBlock } from '../types'

/** Restore only missing records, keeping later additions, edits and deletions intact. */
export function restoreRemoved<T extends { id: string }>(current: T[], before: T[], removedIds: string[]): T[] {
  const wanted = new Set(removedIds)
  const result = [...current]
  for (let index = 0; index < before.length; index++) {
    const item = before[index]
    if (!wanted.has(item.id) || result.some((entry) => entry.id === item.id)) continue
    const next = before.slice(index + 1).find((entry) => result.some((record) => record.id === entry.id))
    const previous = before.slice(0, index).reverse().find((entry) => result.some((record) => record.id === entry.id))
    const at = next ? result.findIndex((entry) => entry.id === next.id)
      : previous ? result.findIndex((entry) => entry.id === previous.id) + 1 : Math.min(index, result.length)
    result.splice(at, 0, item)
  }
  return result
}

export function restoreDeletedLayer(current: ComposerBlock[], before: ComposerBlock[], deletedId: string): ComposerBlock[] {
  if (before.some((block) => block.id === deletedId)) return restoreRemoved(current, before, [deletedId])
  const originalRow = before.find((block): block is PhotoRowBlock => block.type === 'photo-row' && block.photos.some((photo) => photo.id === deletedId))
  const deleted = originalRow?.photos.find((photo) => photo.id === deletedId)
  if (!originalRow || !deleted || current.some((block) => block.id === deletedId || block.type === 'photo-row' && block.photos.some((photo) => photo.id === deletedId))) return current
  const siblingId = originalRow.photos.find((photo) => photo.id !== deletedId)!.id
  const siblingIndex = current.findIndex((block) => block.id === siblingId && block.type === 'photo')
  if (siblingIndex >= 0) {
    const sibling = current[siblingIndex]
    const restored: PhotoRowBlock = { ...originalRow, photos: originalRow.photos.map((photo) => photo.id === siblingId ? sibling : deleted) as PhotoRowBlock['photos'] }
    return current.map((block, index) => index === siblingIndex ? restored : block)
  }
  // A second deletion is independent: do not resurrect the sibling that was removed later.
  return restoreRemoved(current, before.map((block) => block.id === originalRow.id ? deleted : block), [deleted.id])
}
