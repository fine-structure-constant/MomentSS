import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPhotoOverlay, createTextBlock } from './defaults'
import {
  pickOverlayStyle,
  pickTextStyle,
  readOverlayStylePreset,
  readResourceView,
  readTextStylePreset,
  rememberOverlayStyle,
  rememberResourceView,
  rememberTextStyle,
} from './preferences'

const TEXT_STYLE_KEY = 'liubai-text-style'
const OVERLAY_STYLE_KEY = 'liubai-overlay-style'
const RESOURCE_VIEW_KEY = 'liubai-resource-view'
const store = new Map<string, string>()
const globals = globalThis as Record<string, unknown>
const originalWindow = globals.window

function stubStorage() {
  globals.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    },
  }
}

beforeEach(() => {
  store.clear()
  stubStorage()
})

afterEach(() => {
  if (originalWindow === undefined) delete globals.window
  else globals.window = originalWindow
})

describe('remembered text styling', () => {
  it('reuses the last edited styling and stores only reusable keys', () => {
    rememberTextStyle({ ...createTextBlock('写下这一刻'), fontSize: 96, color: '#ff806c' })
    expect(readTextStylePreset()).toMatchObject({ fontSize: 96, color: '#ff806c' })
    expect(readTextStylePreset()).not.toHaveProperty('text')
    expect(readTextStylePreset()).not.toHaveProperty('padding')
  })

  it('starts a new card from the remembered styling instead of the hard-coded default', () => {
    rememberTextStyle({ ...createTextBlock(''), fontSize: 96, align: 'left' })
    const next = createTextBlock('新的文字', readTextStylePreset() ?? {})
    expect(next.fontSize).toBe(96)
    expect(next.align).toBe('left')
    expect(next.text).toBe('新的文字')
    expect(next.fontWeight).toBe(600)
  })

  it('drops tampered or out-of-range values instead of breaking the editor', () => {
    store.set(TEXT_STYLE_KEY, JSON.stringify({ fontSize: 9999, fontWeight: 500, align: 'diagonal', color: 'red', italic: 'yes', rotation: 0 }))
    expect(readTextStylePreset()).toEqual({ rotation: 0 })
  })

  it('ignores unparsable, non-object and empty payloads', () => {
    store.set(TEXT_STYLE_KEY, '{oops')
    expect(readTextStylePreset()).toBeNull()
    store.set(TEXT_STYLE_KEY, '"just a string"')
    expect(readTextStylePreset()).toBeNull()
    store.set(TEXT_STYLE_KEY, '{}')
    expect(readTextStylePreset()).toBeNull()
  })
})

describe('remembered overlay styling', () => {
  it('keeps container geometry but never the text or its position', () => {
    rememberOverlayStyle(createPhotoOverlay('把风景写进故事里', { borderRadius: 24, borderStyle: 'dashed', x: 0.2, y: 0.3 }))
    const preset = readOverlayStylePreset()
    expect(preset).toMatchObject({ borderRadius: 24, borderStyle: 'dashed', width: 0.72 })
    expect(preset).not.toHaveProperty('text')
    expect(preset).not.toHaveProperty('x')
    expect(preset).not.toHaveProperty('y')
  })

  it('projects only known keys when persisting an edit', () => {
    const overlay = createPhotoOverlay('t', { boxPadding: 40, borderWidth: 6 })
    expect(pickOverlayStyle(overlay)).toMatchObject({ boxPadding: 40, borderWidth: 6 })
    expect(pickTextStyle(overlay)).not.toHaveProperty('boxPadding')
  })
})

describe('remembered resource view', () => {
  it('keeps the active kind filter and column count across a panel remount', () => {
    rememberResourceView({ kind: 'photo', columns: 4 })
    expect(readResourceView()).toEqual({ kind: 'photo', columns: 4 })
  })

  it('drops a kind or column count the panel cannot render', () => {
    store.set(RESOURCE_VIEW_KEY, JSON.stringify({ kind: 'video', columns: 7 }))
    expect(readResourceView()).toBeNull()
    store.set(RESOURCE_VIEW_KEY, JSON.stringify({ kind: 'collage', columns: 7 }))
    expect(readResourceView()).toEqual({ kind: 'collage' })
  })

  it('persists only the known view keys', () => {
    rememberResourceView({ kind: 'text' })
    expect(JSON.parse(store.get(RESOURCE_VIEW_KEY) ?? '{}')).toEqual({ kind: 'text' })
  })
})

describe('without browser storage', () => {
  it('reads nothing and writes nothing instead of throwing', () => {
    delete globals.window
    expect(() => rememberTextStyle(createTextBlock(''))).not.toThrow()
    expect(() => rememberOverlayStyle(createPhotoOverlay(''))).not.toThrow()
    expect(() => rememberResourceView({ kind: 'text', columns: 2 })).not.toThrow()
    expect(readTextStylePreset()).toBeNull()
    expect(readOverlayStylePreset()).toBeNull()
    expect(readResourceView()).toBeNull()
  })
})
