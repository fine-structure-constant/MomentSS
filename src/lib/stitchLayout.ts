import type { ComposerBlock, ComposerSettings, PhotoBlock, PhotoOverlay, TextAppearance } from '../types'
import { clamp, computeCropRect, resolvePhotoOverlayLayout, type CropRect } from './geometry'
import { splitGraphemes } from './textInput'

export type TextMeasure = (text: string, style: TextAppearance) => number

export function createTextMeasurer(): TextMeasure {
  // Measurement only; the interactive preview never paints a canvas.
  const context = document.createElement('canvas').getContext('2d')
  return (text, style) => {
    if (!context) return splitGraphemes(text).length * style.fontSize
    context.font = `${style.italic ? 'italic' : 'normal'} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
    return context.measureText(text).width
  }
}

export function wrapLayoutText(text: string, maxWidth: number, style: TextAppearance, measure: TextMeasure): string[] {
  return text.split('\n').flatMap((paragraph) => {
    const lines: string[] = []
    let line = ''
    for (const character of splitGraphemes(paragraph)) {
      if (line && measure(line + character, style) > maxWidth) {
        lines.push(line)
        line = character
      } else line += character
    }
    lines.push(line)
    return lines
  })
}

export interface TextLayout { lines: string[]; lineHeight: number }
export interface PhotoPlacement {
  photo: PhotoBlock
  x: number
  width: number
  height: number
  crop: CropRect
}
export interface StitchLayoutItem {
  block: ComposerBlock
  x: number
  y: number
  width: number
  height: number
  text?: TextLayout
  photos: PhotoPlacement[]
}
export interface StitchLayout { width: number; height: number; items: StitchLayoutItem[] }

function placePhoto(photo: PhotoBlock, x: number, width: number, height: number): PhotoPlacement {
  return { photo, x, width, height, crop: computeCropRect(photo.width, photo.height, width / height, {
    zoom: photo.cropZoom ?? 1, x: photo.cropX ?? 0, y: photo.cropY ?? 0,
  }) }
}

export function buildStitchLayout(blocks: ComposerBlock[], settings: ComposerSettings, measure: TextMeasure): StitchLayout {
  const width = Math.max(1, settings.width - settings.padding * 2)
  let y = settings.padding
  const items = blocks.map((block): StitchLayoutItem => {
    let height: number
    let text: TextLayout | undefined
    let photos: PhotoPlacement[] = []
    if (block.type === 'photo') {
      height = width * block.height / block.width * ((block.frameHeight ?? 100) / 100)
      photos = [placePhoto(block, 0, width, height)]
    } else if (block.type === 'photo-row') {
      height = width * ((block.heightRatio ?? 62) / 100)
      const gap = Math.min(block.gap ?? settings.gap, width - 2)
      const cellWidth = Math.max(1, (width - gap) / 2)
      photos = block.photos.map((photo, index) => placePhoto(photo, index * (cellWidth + gap), cellWidth, height))
    } else {
      const lines = wrapLayoutText(block.text, Math.max(40, width - block.padding * 2), block, measure)
      const lineHeight = block.fontSize * block.lineHeight
      const rotationRoom = Math.abs(Math.sin(block.rotation * Math.PI / 180)) * width * 0.12
      height = Math.max(120, lines.length * lineHeight + block.padding * 2 + rotationRoom)
      text = { lines, lineHeight }
    }
    const item = { block, x: settings.padding, y, width, height, text, photos }
    y += height + settings.gap
    return item
  })
  return { width: settings.width, height: Math.max(1, y - (blocks.length ? settings.gap : 0) + settings.padding), items }
}

export function layoutPhotoOverlay(overlay: PhotoOverlay, width: number, height: number, measure: TextMeasure) {
  const layout = resolvePhotoOverlayLayout(overlay)
  const boxWidth = width * layout.width
  const padding = overlay.boxPadding ?? 28
  const lines = wrapLayoutText(overlay.text, Math.max(40, boxWidth - padding * 2), overlay, measure)
  const lineHeight = overlay.fontSize * overlay.lineHeight
  const boxHeight = Math.max(lineHeight + padding * 2, lines.length * lineHeight + padding * 2)
  return {
    width: boxWidth, height: boxHeight, padding, lines, lineHeight,
    x: clamp(width * layout.x, boxWidth / 2, width - boxWidth / 2),
    y: clamp(height * layout.y, boxHeight / 2, height - boxHeight / 2),
  }
}
