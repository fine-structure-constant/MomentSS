import type { ComposerBlock, RichTextNode, TextAppearance } from '../types'

export const FONT_OPTIONS = [
  { label: 'text.fontRounded', value: '"MomentRounded-v1", sans-serif', family: 'MomentRounded-v1' },
  { label: 'text.fontSans', value: '"MomentSans-v1", sans-serif', family: 'MomentSans-v1' },
  { label: 'text.fontSerif', value: '"Songti SC", SimSun, serif', family: null },
  { label: 'text.fontHand', value: 'KaiTi, "STKaiti", serif', family: null },
] as const

const loaded = new Map<string, Promise<void>>()
export function fontFamilies(styles: TextAppearance[]): string[] {
  const families = new Set<string>()
  const scan = (node: RichTextNode) => {
    for (const mark of node.marks ?? []) if (typeof mark.attrs?.fontFamily === 'string') families.add(mark.attrs.fontFamily)
    node.content?.forEach(scan)
  }
  for (const style of styles) { families.add(style.fontFamily); style.richText?.content.forEach(scan) }
  return [...families].sort()
}
export async function ensureTextFonts(styles: TextAppearance[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all(fontFamilies(styles).map(async (family) => {
    const entry = FONT_OPTIONS.find((font) => font.family && family.includes(font.family))
    if (!entry?.family) return
    if (!loaded.has(entry.family)) {
      const promise = document.fonts.load(`400 16px "${entry.family}"`, '旅途 Aa').then((faces) => {
        if (!faces.length) throw new Error('font-unavailable')
      }).catch((error) => { loaded.delete(entry.family!); throw error })
      loaded.set(entry.family, promise)
    }
    await loaded.get(entry.family)
  }))
}
export function textStyles(blocks: ComposerBlock[]): TextAppearance[] {
  return blocks.flatMap((block) => block.type === 'text' ? [block] : block.type === 'photo' ? block.overlay ? [block.overlay] : [] : block.photos.flatMap((photo) => photo.overlay ? [photo.overlay] : []))
}
export const ensureBlockFonts = (blocks: ComposerBlock[]) => ensureTextFonts(textStyles(blocks))
