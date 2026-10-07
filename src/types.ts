export type ToolId = 'stitch' | 'cover' | 'grid'

export type TextAlign = 'left' | 'center' | 'right'

export interface TextAppearance {
  text: string
  color: string
  background: string
  fontFamily: string
  fontSize: number
  fontWeight: 400 | 600 | 700
  italic: boolean
  align: TextAlign
  rotation: number
  lineHeight: number
}

export interface PhotoOverlay extends TextAppearance {
  /** Normalized center point and width inside the photo. Optional for legacy drafts. */
  x?: number
  y?: number
  width?: number
  backgroundOpacity?: number
  /** Legacy three-position drafts are migrated at render time. */
  position?: 'top' | 'center' | 'bottom'
}

export interface PhotoBlock {
  id: string
  type: 'photo'
  name: string
  blob: Blob
  width: number
  height: number
  overlay?: PhotoOverlay
}

export interface TextBlock extends TextAppearance {
  id: string
  type: 'text'
  padding: number
}

export type ComposerBlock = PhotoBlock | TextBlock

export interface ComposerSettings {
  width: number
  gap: number
  padding: number
  background: string
  format: 'image/jpeg' | 'image/png'
  quality: number
}

export interface CropState {
  zoom: number
  x: number
  y: number
}

export interface SourceImage {
  name: string
  blob: Blob
  width: number
  height: number
}

export interface StitchDraft {
  blocks: ComposerBlock[]
  settings: ComposerSettings
  updatedAt: number
}
