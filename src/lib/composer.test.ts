import { describe, expect, it } from 'vitest'
import { findComposerAsset, pairPhotoWithNeighbor, removeAssetFromBlocks, splitPhotoRow, updatePhotoInBlocks } from './composer'
import type { ComposerBlock, PhotoBlock } from '../types'

const photo = (id: string): PhotoBlock => ({ id, type: 'photo', name: id, blob: new Blob(), width: 1200, height: 800 })

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
