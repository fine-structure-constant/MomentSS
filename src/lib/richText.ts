import type { RichTextDocument, RichTextNode, TextAlign, TextAppearance } from '../types'
import { splitGraphemes } from './textInput'
import type { TextMeasure } from './stitchLayout'

export interface RunStyle extends TextAppearance { underline?: boolean; strike?: boolean }
export interface TextRun { text: string; x: number; y: number; width: number; style: RunStyle }
export interface RichLayout { lines: string[]; lineHeight: number; height: number; runs: TextRun[]; rich: boolean }
interface Inline { text: string; style: RunStyle }
interface Paragraph { spans: Inline[]; align: TextAlign; indent: number; gap: number; style: RunStyle }

/** Old plain text is literal JSON, never reinterpreted as Markdown. */
export function plainTextDocument(text: string): RichTextDocument {
  return { version: 1, type: 'doc', content: text.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) }
}
export function documentText(document: RichTextDocument): string {
  const walk = (node: RichTextNode): string => node.type === 'text' ? node.text ?? '' : node.type === 'hardBreak' ? '\n' : (node.content ?? []).map(walk).join(['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type) ? '\n' : '')
  return document.content.map(walk).join('\n')
}
function markedStyle(node: RichTextNode, base: RunStyle): RunStyle {
  let style = { ...base, richText: undefined }
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') style.fontWeight = 700
    if (mark.type === 'italic') style.italic = true
    if (mark.type === 'underline') style.underline = true
    if (mark.type === 'strike') style.strike = true
    if (mark.type === 'textStyle') {
      const attrs = mark.attrs ?? {}
      if (typeof attrs.fontFamily === 'string' && attrs.fontFamily.length <= 200) style.fontFamily = attrs.fontFamily
      if (typeof attrs.color === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(attrs.color)) style.color = attrs.color
      const size = typeof attrs.fontSize === 'string' ? parseFloat(attrs.fontSize) : Number(attrs.fontSize)
      if (Number.isFinite(size) && size >= 8 && size <= 400) style.fontSize = size
    }
  }
  return style
}
function paragraphs(style: TextAppearance): Paragraph[] {
  if (!style.richText) return style.text.split('\n').map((text) => ({ spans: [{ text, style }], align: style.align, indent: 0, gap: 0, style }))
  const result: Paragraph[] = []
  const inline = (node: RichTextNode, inherited: RunStyle): Inline[] => {
    if (node.type === 'text') return [{ text: node.text ?? '', style: markedStyle(node, inherited) }]
    if (node.type === 'hardBreak') return [{ text: '\n', style: inherited }]
    return (node.content ?? []).flatMap((child) => inline(child, inherited))
  }
  const walk = (node: RichTextNode, depth = 0, prefix = '', quoted = false) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const level = Number(node.attrs?.level ?? 1)
      const heading = node.type === 'heading'
      const base: RunStyle = { ...style, fontSize: style.fontSize * (heading ? level === 1 ? 1.6 : level === 2 ? 1.35 : 1.15 : 1), fontWeight: heading ? 700 : style.fontWeight, italic: quoted || style.italic }
      const align = ['left', 'center', 'right'].includes(String(node.attrs?.textAlign)) ? node.attrs!.textAlign as TextAlign : depth || quoted ? 'left' : style.align
      result.push({ spans: [...(prefix ? [{ text: prefix, style: base }] : []), ...(node.content ?? []).flatMap((child) => inline(child, base))], align, indent: depth * style.fontSize * 0.7, gap: heading ? style.fontSize * 0.25 : 0, style: base })
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const start = Number(node.attrs?.start ?? 1)
      node.content?.forEach((item, index) => { item.content?.forEach((child, childIndex) => walk(child, depth + 1, childIndex === 0 ? node.type === 'bulletList' ? '• ' : `${start + index}. ` : '', quoted)) })
    } else if (node.type === 'blockquote') node.content?.forEach((child, index) => walk(child, depth + 1, index === 0 ? '│ ' : '', true))
    else node.content?.forEach((child) => walk(child, depth, prefix, quoted))
  }
  style.richText.content.forEach((node) => walk(node))
  return result.length ? result : [{ spans: [], align: style.align, indent: 0, gap: 0, style }]
}
const styleKey = (style: RunStyle) => [style.fontFamily, style.fontSize, style.fontWeight, style.italic, style.color, style.underline, style.strike].join('|')

/** One run geometry feeds SVG and Canvas; a grapheme is never split across lines. */
export function layoutRichText(style: TextAppearance, maxWidth: number, measure: TextMeasure): RichLayout {
  const runs: TextRun[] = [], lines: string[] = []
  let top = 0
  for (const paragraph of paragraphs(style)) {
    const indent = Math.min(paragraph.indent, maxWidth * 0.4)
    const available = Math.max(1, maxWidth - indent)
    let line: Array<Inline & { width: number }> = []
    let lineWidth = 0
    const flush = () => {
      const fontSize = Math.max(paragraph.style.fontSize, ...line.map((part) => part.style.fontSize))
      const height = Math.max(fontSize * style.lineHeight, ...line.map((part) => part.style.fontSize * part.style.lineHeight))
      const baseline = top + (height - fontSize) / 2 + fontSize * 0.8
      let x = indent + (paragraph.align === 'center' ? (available - lineWidth) / 2 : paragraph.align === 'right' ? available - lineWidth : 0)
      for (const part of line) { runs.push({ ...part, x, y: baseline }); x += part.width }
      lines.push(line.map((part) => part.text).join(''))
      top += height
      line = []; lineWidth = 0
    }
    for (const span of paragraph.spans) for (const grapheme of splitGraphemes(span.text)) {
      if (grapheme === '\n') { flush(); continue }
      let last = line.at(-1)
      const merge = !!last && styleKey(last.style) === styleKey(span.style)
      let width = measure(merge ? last!.text + grapheme : grapheme, span.style)
      if (line.length && lineWidth - (merge ? last!.width : 0) + width > available) { flush(); last = undefined; width = measure(grapheme, span.style) }
      if (last && merge) { lineWidth += width - last.width; last.text += grapheme; last.width = width }
      else { line.push({ text: grapheme, style: span.style, width }); lineWidth += width }
    }
    flush()
    top += paragraph.gap
  }
  return { runs, lines, height: top, lineHeight: style.fontSize * style.lineHeight, rich: !!style.richText }
}
