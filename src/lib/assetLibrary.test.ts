import { describe, expect, it } from 'vitest'
import { createLayerFromAsset, recoverEditedAssets, recoverImportedAssets, saveEditedAsset } from './assetLibrary'
import { findComposerAsset, pairPhotoWithNext, removeAssetFromBlocks, updatePhotoInBlocks } from './composer'
import { createPhotoOverlay, createTextBlock } from './defaults'
import type { PhotoBlock, TextBlock } from '../types'

const photo: PhotoBlock = { id: 'source', type: 'photo', name: '海边.jpg', blob: new Blob(), width: 1200, height: 800, overlay: createPhotoOverlay('旅途') }

describe('independent asset library', () => {
  it('creates independent layers without copying image bytes or mutating the source', () => {
    const first = createLayerFromAsset(photo)
    const second = createLayerFromAsset(photo)
    expect(first.id).not.toBe(second.id)
    expect(first.sourceId).toBe(photo.id)
    expect(first.type === 'photo' && first.blob).toBe(photo.blob)
    const changed = updatePhotoInBlocks([first, second], first.id, { cropZoom: 3 })
    expect(findComposerAsset(changed, first.id)).toMatchObject({ cropZoom: 3 })
    expect(photo.cropZoom).toBeUndefined()
    expect(findComposerAsset(changed, second.id)).not.toHaveProperty('cropZoom')
    expect(removeAssetFromBlocks(changed, first.id)).toHaveLength(1)
    expect(photo.id).toBe('source')
  })

  it('recovers old drafts including nested photos, deduplicating later source references', () => {
    const first = createLayerFromAsset(photo)
    const second = { ...createLayerFromAsset(photo), sourceId: 'another-source' }
    const paired = pairPhotoWithNext([first, second], first.id).blocks
    const recovered = recoverImportedAssets([...paired, createLayerFromAsset(photo), createTextBlock('记录')])
    expect(recovered).toHaveLength(3)
    expect(recovered.map((asset) => asset.id)).toContain('source')
    expect(recovered[0].sourceId).toBeUndefined()
  })

  it('stores edited text and its formatting in the source template, preserving existing copies', () => {
    const original = createTextBlock('初稿')
    const first = createLayerFromAsset(original) as TextBlock
    const second = createLayerFromAsset(original)
    const edited: TextBlock = { ...first, text: '第一行\n第二行', fontFamily: 'serif', fontSize: 72, fontWeight: 700, italic: true, color: '#ff0000', background: '#eeeeee', align: 'right', rotation: 8, lineHeight: 1.8, padding: 100 }
    const [saved] = saveEditedAsset([original], edited)
    expect(saved).toEqual({ ...edited, id: original.id, sourceId: undefined })
    expect(original.text).toBe('初稿')
    expect(second).toMatchObject({ text: '初稿' })
    expect(createLayerFromAsset(saved)).toMatchObject({ ...edited, id: expect.any(String), sourceId: original.id })
  })

  it('stores structured photo overlays including positioning, frame and container styles', () => {
    const layer = createLayerFromAsset(photo) as PhotoBlock
    const edited: PhotoBlock = { ...layer, cropZoom: 2, cropX: 0.3, frameHeight: 0.6, overlay: { ...createPhotoOverlay('新的图片文字'), x: 0.4, y: 0.2, width: 0.5, rotation: 7, backgroundOpacity: 60, boxPadding: 32, borderStyle: 'dashed', borderWidth: 4, borderColor: '#eeffaa', borderRadius: 20 } }
    const [saved] = saveEditedAsset([photo], edited)
    expect(saved).toEqual({ ...edited, id: photo.id, sourceId: undefined })
    expect(saved.type === 'photo' && saved.blob).toBe(photo.blob)
    expect(saved.type === 'photo' && saved.overlay).not.toBe(edited.overlay)
    const reused = createLayerFromAsset(saved) as PhotoBlock
    expect(reused.overlay).toEqual(edited.overlay)
    const [removed] = saveEditedAsset([saved], { ...reused, overlay: undefined })
    expect(removed.type === 'photo' && removed.overlay).toBeUndefined()
  })

  it('supports legacy layer ids and never resurrects intentionally removed resources', () => {
    const updated = { ...photo, overlay: createPhotoOverlay('旧图层的编辑') }
    expect(saveEditedAsset([photo], updated)[0]).toMatchObject({ overlay: { text: '旧图层的编辑' } })
    expect(saveEditedAsset([], updated)).toEqual([])
    const unrelated = createTextBlock('无关资源')
    expect(saveEditedAsset([unrelated], updated)).toEqual([unrelated])
  })

  it('repairs unsynchronized text and nested photo edits without rolling back to an untouched copy', () => {
    const originalText = createTextBlock('默认文字')
    const editedText = { ...createLayerFromAsset(originalText), text: '已编辑的文字' } as TextBlock
    const first = createLayerFromAsset(photo) as PhotoBlock
    const second = createLayerFromAsset(photo) as PhotoBlock
    const paired = pairPhotoWithNext([first, second], first.id).blocks
    const blocks = updatePhotoInBlocks(paired, first.id, { overlay: createPhotoOverlay('未同步的图片文字') })
    const repaired = recoverEditedAssets([photo, originalText], [...blocks, editedText, createLayerFromAsset(originalText)])
    expect(repaired[0]).toMatchObject({ id: photo.id, overlay: { text: '未同步的图片文字' } })
    expect(repaired[1]).toMatchObject({ id: originalText.id, text: '已编辑的文字' })
    expect(recoverEditedAssets([], [...blocks, editedText])).toEqual([])
  })

  it('keeps the latest explicitly synchronized edit when another placed copy is older', () => {
    const first = createLayerFromAsset(photo) as PhotoBlock
    const second = createLayerFromAsset(photo) as PhotoBlock
    const firstEdit = { ...first, overlay: createPhotoOverlay('较早的编辑') }
    const secondEdit = { ...second, overlay: createPhotoOverlay('最新的编辑') }
    const saved = saveEditedAsset(saveEditedAsset([photo], firstEdit), secondEdit)
    expect(createLayerFromAsset(saved[0])).toMatchObject({ overlay: { text: '最新的编辑' } })
    expect(firstEdit.overlay.text).toBe('较早的编辑')
  })
})
