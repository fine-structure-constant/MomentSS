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
  /** Text-container styling. Optional fields keep older drafts compatible. */
  boxPadding?: number
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted'
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
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
  /** Percentage of the natural rendered height used by the photo frame. */
  frameHeight?: number
  /** Crop controls inside the frame. Optional for legacy drafts. */
  cropZoom?: number
  cropX?: number
  cropY?: number
}

export interface PhotoRowBlock {
  id: string
  type: 'photo-row'
  photos: [PhotoBlock, PhotoBlock]
  /** Row height as a percentage of the full collage content width. */
  heightRatio?: number
  /** Gap between the two cells in output pixels. */
  gap?: number
}

export interface TextBlock extends TextAppearance {
  id: string
  type: 'text'
  padding: number
}

export type ComposerBlock = PhotoBlock | PhotoRowBlock | TextBlock

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
