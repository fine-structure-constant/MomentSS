import type { ComposerSettings, CropState, PhotoOverlay, TextBlock } from '../types'

export const DEFAULT_SETTINGS: ComposerSettings = {
  width: 1080,
  gap: 0,
  padding: 0,
  background: '#ffffff',
  format: 'image/jpeg',
  quality: 0.92,
}

export const DEFAULT_CROP: CropState = { zoom: 1, x: 0, y: 0 }

export function createTextBlock(after = Date.now()): TextBlock {
  return {
    id: `text-${after}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'text',
    text: '写下这一刻',
    color: '#10223d',
    background: '#fff8f2',
    fontFamily: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif',
    fontSize: 58,
    fontWeight: 600,
    italic: false,
    align: 'center',
    rotation: 0,
    padding: 72,
    lineHeight: 1.35,
  }
}

export function createPhotoOverlay(): PhotoOverlay {
  return {
    text: '把风景写进故事里',
    color: '#ffffff',
    background: '#10223d',
    fontFamily: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif',
    fontSize: 54,
    fontWeight: 600,
    italic: false,
    align: 'center',
    rotation: 0,
    lineHeight: 1.25,
    x: 0.5,
    y: 0.78,
    width: 0.72,
    backgroundOpacity: 58,
  }
}
