import { describe, expect, it } from 'vitest'
import { dateGroup, normalizeResource, resourceDate, sortResources } from './resourceCatalog'
import { parseCaptureTime } from './photoMetadata'
import { createTextBlock } from './defaults'
import type { PhotoBlock } from '../types'

describe('resource dates and order', () => {
  it('sorts names naturally without mutating the source order', () => {
    const assets = ['IMG_10', 'IMG_2', 'IMG_1'].map((displayName) => ({ ...createTextBlock(''), displayName }))
    expect(sortResources(assets, 'name').map((item) => item.displayName)).toEqual(['IMG_1', 'IMG_2', 'IMG_10'])
    expect(assets[0].displayName).toBe('IMG_10')
  })
  it('keeps unknown capture times last and equal timestamps in import order', () => {
    const assets = [{ ...createTextBlock('unknown') }, { ...createTextBlock('later'), capturedAt: 200, importOrder: 2 }, { ...createTextBlock('earlier'), capturedAt: 100 }, { ...createTextBlock('same'), capturedAt: 200, importOrder: 1 }]
    expect(sortResources(assets, 'captured-desc').map((item) => 'text' in item ? item.text : '')).toEqual(['same', 'later', 'earlier', 'unknown'])
  })
  it('uses mutually exclusive local calendar bands', () => {
    const now = new Date(2026, 9, 25, 0, 10).getTime()
    const at = (day: number) => new Date(2026, 9, day, 23, 59).getTime()
    expect([25, 24, 23, 19, 18, 1].map((day) => dateGroup(at(day), now))).toEqual(['today', 'yesterday', 'week', 'week', 'month', 'month'])
    expect(dateGroup(new Date(2026, 8, 1).getTime(), now)).toBe('older')
    expect(dateGroup(undefined, now)).toBe('unknown')
  })
  it('preserves a naive EXIF clock time and applies only an explicit offset', () => {
    expect(parseCaptureTime('2026:10:25 12:30:00', undefined)).toEqual({ capturedLocalTime: '2026-10-25T12:30:00' })
    const parsed = parseCaptureTime('2026:10:25 12:30:00', '+08:00')
    expect(parsed.capturedAt).toBe(Date.UTC(2026, 9, 25, 4, 30))
    expect(parsed.capturedOffsetMinutes).toBe(480)
    expect(parseCaptureTime('2026:02:30 12:00:00', '+08:00')).toEqual({})
  })
  it('does not invent historical import dates from file modification dates', () => {
    const photo: PhotoBlock = { id: 'old', type: 'photo', name: 'old.jpg', blob: Object.assign(new Blob(), { lastModified: 123 }), width: 10, height: 10 }
    const normalized = normalizeResource(photo)
    expect(normalized.fileModifiedAt).toBe(123)
    expect(resourceDate(normalized, 'imported')).toBeUndefined()
  })
})
