import type {
  ComposerBlock,
  ComposerSettings,
  CropState,
  PhotoBlock,
  PhotoOverlay,
  PhotoRowBlock,
  SourceImage,
  TextBlock,
} from '../types'
import { clamp, computeCropRect, fitCanvasSize, gridDimensions, resolvePhotoOverlayLayout } from './geometry'

interface LoadedImage {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

async function loadImage(blob: Blob): Promise<LoadedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      // SVG and a few browser-decoded formats need the HTMLImageElement path.
    }
  }

  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  }
}

export async function inspectImage(file: Blob): Promise<{ width: number; height: number }> {
  const loaded = await loadImage(file)
  const result = { width: loaded.width, height: loaded.height }
  loaded.close()
  return result
}

function setTextFont(context: CanvasRenderingContext2D, block: TextBlock, scale: number): void {
  const style = block.italic ? 'italic' : 'normal'
  context.font = `${style} ${block.fontWeight} ${block.fontSize * scale}px ${block.fontFamily}`
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n')
  const lines: string[] = []

  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push('')
      return
    }
    let line = ''
    for (const character of Array.from(paragraph)) {
      const test = `${line}${character}`
      if (line && context.measureText(test).width > maxWidth) {
        lines.push(line)
        line = character
      } else {
        line = test
      }
    }
    lines.push(line)
  })

  return lines.length ? lines : ['']
}

function textMetrics(
  context: CanvasRenderingContext2D,
  block: TextBlock,
  innerWidth: number,
  scale: number,
): { lines: string[]; height: number; lineHeight: number } {
  setTextFont(context, block, scale)
  const padding = block.padding * scale
  const lines = wrapText(context, block.text, Math.max(40, innerWidth - padding * 2))
  const lineHeight = block.fontSize * block.lineHeight * scale
  const rotationRoom = Math.abs(Math.sin((block.rotation * Math.PI) / 180)) * innerWidth * 0.12
  return {
    lines,
    lineHeight,
    height: Math.max(120 * scale, lines.length * lineHeight + padding * 2 + rotationRoom),
  }
}

function drawPhotoOverlay(
  context: CanvasRenderingContext2D,
  overlay: PhotoOverlay,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
): void {
  const layout = resolvePhotoOverlayLayout(overlay)
  const boxWidth = width * layout.width
  const textPadding = (overlay.boxPadding ?? 28) * scale
  const style = overlay.italic ? 'italic' : 'normal'
  context.font = `${style} ${overlay.fontWeight} ${overlay.fontSize * scale}px ${overlay.fontFamily}`
  const lines = wrapText(context, overlay.text, Math.max(40, boxWidth - textPadding * 2))
  const lineHeight = overlay.fontSize * overlay.lineHeight * scale
  const boxHeight = Math.max(lineHeight + textPadding * 2, lines.length * lineHeight + textPadding * 2)
  const centerX = clamp(x + width * layout.x, x + boxWidth / 2, x + width - boxWidth / 2)
  const centerY = clamp(y + height * layout.y, y + boxHeight / 2, y + height - boxHeight / 2)
  context.save()
  context.translate(centerX, centerY)
  context.rotate((overlay.rotation * Math.PI) / 180)
  roundedRectPath(
    context,
    -boxWidth / 2,
    -boxHeight / 2,
    boxWidth,
    boxHeight,
    (overlay.borderRadius ?? 0) * scale,
  )
  context.fillStyle = colorWithOpacity(overlay.background, overlay.backgroundOpacity ?? 58)
  context.fill()
  const borderWidth = (overlay.borderWidth ?? 2) * scale
  const borderStyle = overlay.borderStyle ?? 'none'
  if (borderStyle !== 'none' && borderWidth > 0) {
    context.save()
    context.lineWidth = borderWidth
    context.strokeStyle = overlay.borderColor ?? '#ffffff'
    context.lineCap = borderStyle === 'dotted' ? 'round' : 'butt'
    context.setLineDash(
      borderStyle === 'dashed'
        ? [Math.max(4, borderWidth * 4), Math.max(3, borderWidth * 2.5)]
        : borderStyle === 'dotted'
          ? [0, Math.max(4, borderWidth * 3)]
          : [],
    )
    context.stroke()
    context.restore()
  }
  context.font = `${style} ${overlay.fontWeight} ${overlay.fontSize * scale}px ${overlay.fontFamily}`
  context.textAlign = overlay.align
  context.textBaseline = 'middle'
  context.fillStyle = overlay.color
  const textX = overlay.align === 'left' ? -boxWidth / 2 + textPadding : overlay.align === 'right' ? boxWidth / 2 - textPadding : 0
  const startY = -((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => context.fillText(line, textX, startY + index * lineHeight, boxWidth - textPadding * 2))
  context.restore()
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = clamp(radius, 0, Math.min(width, height) / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function rowHeight(block: PhotoRowBlock, width: number): number {
  return width * ((block.heightRatio ?? 62) / 100)
}

async function drawPhotoFrame(
  context: CanvasRenderingContext2D,
  block: PhotoBlock,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
): Promise<void> {
  const loaded = await loadImage(block.blob)
  const crop = computeCropRect(block.width, block.height, width / height, {
    zoom: block.cropZoom ?? 1,
    x: block.cropX ?? 0,
    y: block.cropY ?? 0,
  })
  context.drawImage(loaded.source, crop.sx, crop.sy, crop.sw, crop.sh, x, y, width, height)
  if (block.overlay) drawPhotoOverlay(context, block.overlay, x, y, width, height, scale)
  loaded.close()
}

function colorWithOpacity(color: string, opacity: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (!match) return color
  const [, r, g, b] = match
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity / 100})`
}

export interface RenderReport {
  width: number
  height: number
  reduced: boolean
  scale: number
}

export async function renderStitch(
  canvas: HTMLCanvasElement,
  blocks: ComposerBlock[],
  settings: ComposerSettings,
  requestedWidth = settings.width,
): Promise<RenderReport> {
  const measureCanvas = document.createElement('canvas')
  const measureContext = measureCanvas.getContext('2d')
  if (!measureContext) throw new Error('当前浏览器无法创建图片画布')

  const baseScale = requestedWidth / settings.width
  const outerPadding = settings.padding * baseScale
  const innerWidth = requestedWidth - outerPadding * 2
  const gap = settings.gap * baseScale
  const heights = blocks.map((block) => {
    if (block.type === 'photo') return innerWidth * (block.height / block.width) * ((block.frameHeight ?? 100) / 100)
    if (block.type === 'photo-row') return rowHeight(block, innerWidth)
    return textMetrics(measureContext, block, innerWidth, baseScale).height
  })
  const rawHeight = outerPadding * 2 + heights.reduce((sum, height) => sum + height, 0) + Math.max(0, blocks.length - 1) * gap
  const fitted = fitCanvasSize(requestedWidth, Math.max(1, rawHeight))
  const finalScale = baseScale * fitted.scale
  const finalPadding = settings.padding * finalScale
  const finalInnerWidth = fitted.width - finalPadding * 2
  const finalGap = settings.gap * finalScale

  canvas.width = fitted.width
  canvas.height = fitted.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法创建图片画布')
  context.fillStyle = settings.background
  context.fillRect(0, 0, canvas.width, canvas.height)

  let y = finalPadding
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (block.type === 'photo') {
      const height = finalInnerWidth * (block.height / block.width) * ((block.frameHeight ?? 100) / 100)
      await drawPhotoFrame(context, block, finalPadding, y, finalInnerWidth, height, finalScale)
      y += height
    } else if (block.type === 'photo-row') {
      const height = rowHeight(block, finalInnerWidth)
      const rowGap = (block.gap ?? settings.gap) * finalScale
      const cellWidth = Math.max(1, (finalInnerWidth - rowGap) / 2)
      await Promise.all(block.photos.map((photo, photoIndex) => drawPhotoFrame(
        context,
        photo,
        finalPadding + photoIndex * (cellWidth + rowGap),
        y,
        cellWidth,
        height,
        finalScale,
      )))
      y += height
    } else {
      const metrics = textMetrics(context, block, finalInnerWidth, finalScale)
      context.fillStyle = block.background
      context.fillRect(finalPadding, y, finalInnerWidth, metrics.height)
      context.save()
      context.translate(finalPadding + finalInnerWidth / 2, y + metrics.height / 2)
      context.rotate((block.rotation * Math.PI) / 180)
      setTextFont(context, block, finalScale)
      context.fillStyle = block.color
      context.textBaseline = 'middle'
      context.textAlign = block.align
      const x = block.align === 'left' ? -finalInnerWidth / 2 + block.padding * finalScale : block.align === 'right' ? finalInnerWidth / 2 - block.padding * finalScale : 0
      const startY = -((metrics.lines.length - 1) * metrics.lineHeight) / 2
      metrics.lines.forEach((line, lineIndex) => {
        context.fillText(line, x, startY + lineIndex * metrics.lineHeight)
      })
      context.restore()
      y += metrics.height
    }
    if (index < blocks.length - 1) y += finalGap
  }

  return { width: fitted.width, height: fitted.height, reduced: fitted.reduced, scale: fitted.scale }
}

export async function renderCoverComposite(
  canvas: HTMLCanvasElement,
  source: SourceImage,
  crop: CropState,
  requestedWidth = source.width,
): Promise<RenderReport> {
  const sourceHeightAtWidth = requestedWidth * (source.height / source.width)
  const rawHeight = sourceHeightAtWidth + requestedWidth
  const fitted = fitCanvasSize(requestedWidth, rawHeight)
  canvas.width = fitted.width
  canvas.height = fitted.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法创建图片画布')

  const loaded = await loadImage(source.blob)
  const halfSource = source.height / 2
  const halfDest = (sourceHeightAtWidth / 2) * fitted.scale
  const square = fitted.width
  const cropRect = computeCropRect(source.width, source.height, 1, crop)

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(loaded.source, 0, 0, source.width, halfSource, 0, 0, fitted.width, halfDest)
  context.drawImage(
    loaded.source,
    cropRect.sx,
    cropRect.sy,
    cropRect.sw,
    cropRect.sh,
    0,
    halfDest,
    square,
    square,
  )
  context.drawImage(
    loaded.source,
    0,
    halfSource,
    source.width,
    source.height - halfSource,
    0,
    halfDest + square,
    fitted.width,
    halfDest,
  )
  loaded.close()
  return { width: fitted.width, height: fitted.height, reduced: fitted.reduced, scale: fitted.scale }
}

export async function renderCropPreview(
  canvas: HTMLCanvasElement,
  source: SourceImage,
  crop: CropState,
  targetAspect: number,
  requestedWidth: number,
  grid?: { columns: number; rows: number },
): Promise<void> {
  const targetHeight = requestedWidth / targetAspect
  canvas.width = requestedWidth
  canvas.height = Math.round(targetHeight)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法创建图片画布')
  const loaded = await loadImage(source.blob)
  const rect = computeCropRect(source.width, source.height, targetAspect, crop)
  context.drawImage(loaded.source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height)
  loaded.close()

  if (grid) {
    context.save()
    context.strokeStyle = 'rgba(255,255,255,.96)'
    context.lineWidth = Math.max(2, requestedWidth / 280)
    context.shadowColor = 'rgba(16,34,61,.4)'
    context.shadowBlur = 3
    for (let column = 1; column < grid.columns; column += 1) {
      const x = (canvas.width / grid.columns) * column
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, canvas.height)
      context.stroke()
    }
    for (let row = 1; row < grid.rows; row += 1) {
      const y = (canvas.height / grid.rows) * row
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(canvas.width, y)
      context.stroke()
    }
    context.restore()
  }
}

export async function renderSquareCover(
  canvas: HTMLCanvasElement,
  source: SourceImage,
  crop: CropState,
  size = 1080,
): Promise<void> {
  await renderCropPreview(canvas, source, crop, 1, size)
}

export async function exportGridTiles(
  source: SourceImage,
  crop: CropState,
  count: 4 | 6 | 9,
): Promise<Blob[]> {
  const { columns, rows } = gridDimensions(count)
  const targetAspect = columns / rows
  const rect = computeCropRect(source.width, source.height, targetAspect, crop)
  const naturalTile = Math.floor(rect.sw / columns)
  const tileSize = Math.max(1, Math.min(1440, naturalTile))
  const loaded = await loadImage(source.blob)
  const blobs: Blob[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = tileSize
      canvas.height = tileSize
      const context = canvas.getContext('2d')
      if (!context) continue
      context.drawImage(
        loaded.source,
        rect.sx + (rect.sw / columns) * column,
        rect.sy + (rect.sh / rows) * row,
        rect.sw / columns,
        rect.sh / rows,
        0,
        0,
        tileSize,
        tileSize,
      )
      blobs.push(await canvasToBlob(canvas, 'image/jpeg', 0.94))
    }
  }
  loaded.close()
  return blobs
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('浏览器没有生成图片，请降低输出尺寸后重试'))
    }, type, quality)
  })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

export async function filesToPhotoBlocks(files: File[]): Promise<PhotoBlock[]> {
  const photos: PhotoBlock[] = []
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const dimensions = await inspectImage(file)
    photos.push({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'photo',
      name: file.name,
      blob: file,
      width: dimensions.width,
      height: dimensions.height,
    })
  }
  return photos
}

export async function fileToSourceImage(file: File): Promise<SourceImage> {
  const dimensions = await inspectImage(file)
  return { name: file.name, blob: file, ...dimensions }
}
