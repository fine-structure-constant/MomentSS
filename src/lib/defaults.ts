import type { ComposerSettings, CropState, PhotoOverlay, TextAppearance, TextBlock } from '../types'

export const DEFAULT_SETTINGS: ComposerSettings = {
  width: 1080,
  gap: 0,
  padding: 0,
  background: '#ffffff',
  format: 'image/jpeg',
  quality: 0.92,
}

export const DEFAULT_CROP: CropState = { zoom: 1, x: 0, y: 0 }

const DEFAULT_TEXT_STYLE: Omit<TextBlock, 'id' | 'type' | 'text' | 'padding'> = {
  color: '#10223d',
  background: '#fff8f2',
  fontFamily: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif',
  fontSize: 58,
  fontWeight: 600,
  italic: false,
  align: 'center',
  rotation: 0,
  lineHeight: 1.35,
}

const DEFAULT_OVERLAY_STYLE: Omit<PhotoOverlay, 'text' | 'x' | 'y' | 'position'> = {
  color: '#ffffff',
  background: '#10223d',
  fontFamily: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif',
  fontSize: 54,
  fontWeight: 600,
  italic: false,
  align: 'center',
  rotation: 0,
  lineHeight: 1.25,
  width: 0.72,
  backgroundOpacity: 58,
  boxPadding: 28,
  borderStyle: 'none',
  borderWidth: 2,
  borderColor: '#ffffff',
  borderRadius: 0,
}

/** `preset` carries the last styling the user chose so new cards do not reset it. */
export function createTextBlock(defaultText: string, preset: Partial<TextAppearance> = {}): TextBlock {
  const style = { ...DEFAULT_TEXT_STYLE, ...preset }
  return {
    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'text',
    text: defaultText,
    padding: 72,
    color: style.color,
    background: style.background,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    italic: style.italic,
    align: style.align,
    rotation: style.rotation,
    lineHeight: style.lineHeight,
  }
}

export function createPhotoOverlay(defaultText: string, preset: Partial<PhotoOverlay> = {}): PhotoOverlay {
  const style = { ...DEFAULT_OVERLAY_STYLE, ...preset }
  return {
    text: defaultText,
    x: style.x ?? 0.5,
    y: style.y ?? 0.78,
    color: style.color,
    background: style.background,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    italic: style.italic,
    align: style.align,
    rotation: style.rotation,
    lineHeight: style.lineHeight,
    width: style.width,
    backgroundOpacity: style.backgroundOpacity,
    boxPadding: style.boxPadding,
    borderStyle: style.borderStyle,
    borderWidth: style.borderWidth,
    borderColor: style.borderColor,
    borderRadius: style.borderRadius,
  }
}
