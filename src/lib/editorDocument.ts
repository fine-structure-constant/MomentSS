import type { RichTextNode, TextAppearance } from '../types'
/** A plain paragraph document can use the core editor without losing any formatting. */
export function requiresRichEditor(value: TextAppearance): boolean {
  const rich = value.richText
  if (!rich) return false
  const plain = (node: RichTextNode): boolean => ['paragraph', 'text', 'hardBreak'].includes(node.type) && !node.marks?.length && !Object.values(node.attrs ?? {}).some((attr) => attr !== null && attr !== undefined) && (node.content ?? []).every(plain)
  return !rich.content.every(plain)
}
export function isLightText(color: string): boolean {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  const rgb = hex ? [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16)) : color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  return !!rgb && rgb.length === 3 && rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > 185
}
