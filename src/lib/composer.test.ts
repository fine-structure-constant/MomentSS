import { describe, expect, it } from 'vitest'
import {
  findComposerAsset,
  insertBlockAfter,
  moveBlockToEdge,
  pairPhotoWithNeighbor,
  pairPhotos,
  removeAssetFromBlocks,
  renamePhotosInBlocks,
  splitPhotoRow,
  suggestRowHeightRatio,
  swapRowPhotos,
  updatePhotoInBlocks,
} from './composer'
import { createTextBlock } from './defaults'
import type { ComposerBlock, PhotoBlock } from '../types'

const photo = (id: string): PhotoBlock => ({ id, type: 'photo', name: id, blob: new Blob(), width: 1200, height: 800 })
const portrait = (id: string): PhotoBlock => ({ id, type: 'photo', name: id, blob: new Blob(), width: 800, height: 1200 })

describe('photo rows', () => {
  it('pairs two adjacent photos without changing their order', () => {
    const result = pairPhotoWithNeighbor([photo('a'), photo('b')], 'b')
    expect(result.row?.photos.map((item) => item.id)).toEqual(['a', 'b'])
    expect(result.blocks).toHaveLength(1)
  })

  it('keeps each nested photo independently editable', () => {
    const row = pairPhotoWithNeighbor([photo('a'), photo('b')], 'a').blocks
    const updated = updatePhotoInBlocks(row, 'b', { cropZoom: 2 })
    expect(findComposerAsset(updated, 'b')).toMatchObject({ cropZoom: 2 })
    expect(findComposerAsset(updated, 'a')).not.toHaveProperty('cropZoom')
  })

  it('promotes the remaining photo when one cell is deleted', () => {
    const row = pairPhotoWithNeighbor([photo('a'), photo('b')], 'a').blocks
    expect(removeAssetFromBlocks(row, 'a')).toEqual([photo('b')])
  })

  it('splits a row back into two vertical layers', () => {
    const paired = pairPhotoWithNeighbor([photo('a'), photo('b')], 'a')
    const blocks: ComposerBlock[] = splitPhotoRow(paired.blocks, paired.row!.id)
    expect(blocks.map((block) => block.id)).toEqual(['a', 'b'])
  })
})

describe('choosing which photos go side by side', () => {
  it('pairs two non-adjacent photos and keeps the other layers untouched', () => {
    const text = createTextBlock('标题')
    const blocks: ComposerBlock[] = [photo('a'), text, photo('b')]
    const result = pairPhotos(blocks, 'a', 'b')
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0]).toBe(result.row)
    expect(result.blocks[1]).toBe(text)
    expect(result.row?.photos.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('places the row where the earlier photo was, whatever the click order', () => {
    const text = createTextBlock('标题')
    const result = pairPhotos([text, photo('a'), photo('b')], 'b', 'a')
    expect(result.blocks.map((block) => block.type)).toEqual(['text', 'photo-row'])
    expect(result.row?.photos.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('refuses ids that are the same, unknown, or already inside a row', () => {
    const row = pairPhotoWithNeighbor([photo('a'), photo('b')], 'a').blocks
    expect(pairPhotos([photo('a')], 'a', 'a').row).toBeNull()
    expect(pairPhotos([photo('a')], 'a', 'missing').row).toBeNull()
    expect(pairPhotos(row, 'a', 'a').row).toBeNull()
  })

  it('swaps the two cells of a row without touching anything else', () => {
    const paired = pairPhotoWithNeighbor([photo('a'), photo('b')], 'a')
    const swapped = swapRowPhotos(paired.blocks, paired.row!.id)
    expect(swapped[0].type === 'photo-row' && swapped[0].photos.map((item) => item.id)).toEqual(['b', 'a'])
  })

  it('derives a row height that respects the photos instead of a fixed 62%', () => {
    expect(suggestRowHeightRatio([photo('a'), photo('b')])).toBe(35)
    expect(suggestRowHeightRatio([portrait('a'), portrait('b')])).toBe(75)
    expect(suggestRowHeightRatio([])).toBe(62)
  })
})

describe('layer ordering helpers', () => {
  it('moves a layer to either edge in one step', () => {
    const blocks: ComposerBlock[] = [photo('a'), photo('b'), photo('c')]
    expect(moveBlockToEdge(blocks, 'a', 'end').map((block) => block.id)).toEqual(['b', 'c', 'a'])
    expect(moveBlockToEdge(blocks, 'c', 'start').map((block) => block.id)).toEqual(['c', 'a', 'b'])
    expect(moveBlockToEdge(blocks, 'a', 'start')).toBe(blocks)
  })

  it('inserts after an anchor and falls back to appending', () => {
    const blocks: ComposerBlock[] = [photo('a'), photo('b')]
    const text = createTextBlock('插入')
    expect(insertBlockAfter(blocks, 'a', text).map((block) => block.id)).toEqual(['a', text.id, 'b'])
    expect(insertBlockAfter(blocks, null, text).map((block) => block.id)).toEqual(['a', 'b', text.id])
  })

  it('renames every placed copy of a resource but not other photos', () => {
    const renamed = renamePhotosInBlocks([{ ...photo('a'), sourceId: 'src' }, photo('b')], 'src', '洱海日落')
    expect(findComposerAsset(renamed, 'a')).toMatchObject({ name: '洱海日落' })
    expect(findComposerAsset(renamed, 'b')).toMatchObject({ name: 'b' })
  })
})
