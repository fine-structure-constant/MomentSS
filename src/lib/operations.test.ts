import { describe, expect, it } from 'vitest'
import { restoreDeletedLayer, restoreRemoved } from './operations'
import type { ComposerBlock, PhotoBlock, PhotoRowBlock } from '../types'

const photo = (id: string): PhotoBlock => ({ id, type: 'photo', name: id, blob: new Blob(), width: 10, height: 10 })
describe('operation-scoped undo', () => {
  it('restores a deleted asset without discarding a later addition or edit', () => {
    const before = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    expect(restoreRemoved([{ id: 'b', name: 'edited' }, { id: 'new', name: 'new' }], before, ['a']))
      .toEqual([{ id: 'a', name: 'A' }, { id: 'b', name: 'edited' }, { id: 'new', name: 'new' }])
  })
  it('does not revive an unrelated later deletion and is idempotent', () => {
    const before = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const restored = restoreRemoved([{ id: 'c' }], before, ['a'])
    expect(restored).toEqual([{ id: 'a' }, { id: 'c' }])
    expect(restoreRemoved(restored, before, ['a'])).toEqual(restored)
  })
  it('reverses clearing many items without replacing new items', () => {
    expect(restoreRemoved([{ id: 'new' }], [{ id: 'a' }, { id: 'b' }], ['a', 'b']).map((item) => item.id)).toEqual(['a', 'b', 'new'])
  })
  it('restores a deleted row child with the latest surviving child', () => {
    const row: PhotoRowBlock = { id: 'row', type: 'photo-row', photos: [photo('a'), photo('b')] }
    const current: ComposerBlock[] = [{ ...photo('b'), name: 'edited' }, photo('new')]
    const restored = restoreDeletedLayer(current, [row], 'a')
    expect(restored[0].type).toBe('photo-row')
    expect((restored[0] as PhotoRowBlock).photos[1].name).toBe('edited')
    expect(restored[1].id).toBe('new')
  })
  it('does not revive a row sibling removed after the first operation', () => {
    const row: PhotoRowBlock = { id: 'row', type: 'photo-row', photos: [photo('a'), photo('b')] }
    expect(restoreDeletedLayer([photo('new')], [row], 'a').map((item) => item.id)).toEqual(['a', 'new'])
  })
})
