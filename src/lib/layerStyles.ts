import type { ComposerBlock, PhotoBlock, TextAppearance } from '../types'

export type LayerStyle = { kind: 'text'; value: Omit<TextAppearance, 'text' | 'richText'> } | { kind: 'photo'; value: Pick<PhotoBlock, 'frameHeight'> & { overlay?: Omit<NonNullable<PhotoBlock['overlay']>, 'text' | 'richText'> } }
export function copyLayerStyle(block: ComposerBlock): LayerStyle | null {
  if (block.type === 'photo-row') return null
  if (block.type === 'text') {
    const { color, background, fontFamily, fontSize, fontWeight, italic, align, rotation, lineHeight, emojiStyle } = block
    return { kind: 'text', value: { color, background, fontFamily, fontSize, fontWeight, italic, align, rotation, lineHeight, emojiStyle } }
  }
  const overlay = block.overlay ? (({ text: _text, richText: _richText, ...style }) => style)(block.overlay) : undefined
  return { kind: 'photo', value: { frameHeight: block.frameHeight, overlay } }
}
export function pasteLayerStyle(block: ComposerBlock, style: LayerStyle): ComposerBlock {
  if (block.type === 'text' && style.kind === 'text') return { ...block, ...style.value }
  if (block.type === 'photo' && style.kind === 'photo') return { ...block, frameHeight: style.value.frameHeight, overlay: block.overlay && style.value.overlay ? { ...block.overlay, ...style.value.overlay } : block.overlay }
  return block
}
