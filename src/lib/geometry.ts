import type { CropState, PhotoOverlay } from '../types'

export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function computeCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  crop: CropState,
): CropRect {
  const sourceAspect = sourceWidth / sourceHeight
  let baseWidth: number
  let baseHeight: number

  if (sourceAspect > targetAspect) {
    baseHeight = sourceHeight
    baseWidth = baseHeight * targetAspect
  } else {
    baseWidth = sourceWidth
    baseHeight = baseWidth / targetAspect
  }

  const zoom = clamp(crop.zoom, 1, 4)
  const sw = baseWidth / zoom
  const sh = baseHeight / zoom
  const maxX = sourceWidth - sw
  const maxY = sourceHeight - sh
  const sx = maxX * ((clamp(crop.x, -1, 1) + 1) / 2)
  const sy = maxY * ((clamp(crop.y, -1, 1) + 1) / 2)

  return { sx, sy, sw, sh }
}

export function gridDimensions(count: 4 | 6 | 9): { columns: number; rows: number } {
  if (count === 4) return { columns: 2, rows: 2 }
  if (count === 6) return { columns: 3, rows: 2 }
  return { columns: 3, rows: 3 }
}

/**
 * A focus slider can only move when the cropped window is smaller than the source.
 * At the minimum zoom one axis is usually already flush, so the UI must disable it
 * instead of offering a control that silently does nothing.
 */
export function cropPanRoom(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  crop: CropState,
): { x: boolean; y: boolean } {
  const rect = computeCropRect(sourceWidth, sourceHeight, targetAspect, crop)
  return { x: sourceWidth - rect.sw > 0.5, y: sourceHeight - rect.sh > 0.5 }
}

/** Aspect ratio of the frame a standalone photo gets at the default container height. */
export function photoFrameAspect(photo: { width: number; height: number; frameHeight?: number }): number {
  return (photo.width / photo.height) * (100 / (photo.frameHeight ?? 100))
}

export interface PhotoOverlayLayout {
  x: number
  y: number
  width: number
}

export function resolvePhotoOverlayLayout(overlay: Partial<PhotoOverlay>): PhotoOverlayLayout {
  const width = clamp(overlay.width ?? 0.72, 0.28, 0.94)
  const legacyY = overlay.position === 'top' ? 0.18 : overlay.position === 'center' ? 0.5 : 0.78
  return {
    x: clamp(overlay.x ?? 0.5, width / 2, 1 - width / 2),
    y: clamp(overlay.y ?? legacyY, 0.06, 0.94),
    width,
  }
}

export function fitCanvasSize(
  width: number,
  height: number,
  maxEdge = 16_000,
  maxPixels = 72_000_000,
): { width: number; height: number; scale: number; reduced: boolean } {
  const edgeScale = Math.min(1, maxEdge / width, maxEdge / height)
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (width * height)))
  const scale = Math.min(edgeScale, pixelScale)
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
    reduced: scale < 0.999,
  }
}
