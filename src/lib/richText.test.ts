import { describe, expect, it } from 'vitest'
import { documentText, layoutRichText, plainTextDocument } from './richText'
import { createTextBlock } from './defaults'
import { splitGraphemes } from './textInput'
import type { RichTextDocument } from '../types'

const measure = (text: string, style: { fontSize: number }) => splitGraphemes(text).length * style.fontSize
describe('shared rich text geometry', () => {
  it('keeps legacy Markdown characters literal', () => {
    expect(plainTextDocument('# 标题 **原文**').content).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: '# 标题 **原文**' }] }])
    expect(documentText(plainTextDocument('a\n\nb'))).toBe('a\n\nb')
  })
  it('lays out mixed-size and colored runs on a shared baseline', () => {
    const richText: RichTextDocument = { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }, { type: 'text', text: '大', marks: [{ type: 'textStyle', attrs: { fontSize: '40px', color: '#ff0000' } }, { type: 'bold' }] }] }] }
    const result = layoutRichText({ ...createTextBlock('A大'), fontSize: 20, lineHeight: 1.5, richText }, 200, measure)
    expect(result.height).toBe(60)
    expect(result.runs).toHaveLength(2)
    expect(result.runs[0].y).toBe(result.runs[1].y)
    expect(result.runs[1].style).toMatchObject({ fontSize: 40, color: '#ff0000', fontWeight: 700 })
    expect(result.runs[0].x).toBe(70)
  })
  it('measures heading, list and blank paragraphs without flattening their structure', () => {
    const richText: RichTextDocument = { version: 1, type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '旅途' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '山' }] }] }] }, { type: 'paragraph' }] }
    const result = layoutRichText({ ...createTextBlock(''), fontSize: 20, richText }, 200, measure)
    expect(result.lines).toEqual(['旅途', '• 山', ''])
    expect(result.runs[0].style.fontSize).toBe(32)
    expect(result.runs[1].x).toBeGreaterThan(0)
  })
  it('keeps complex emoji intact across styled wrapping and respects paragraph alignment', () => {
    const emoji = '👨‍👩‍👧‍👦'
    const richText: RichTextDocument = { version: 1, type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: `A${emoji}B` }] }] }
    const result = layoutRichText({ ...createTextBlock(''), fontSize: 10, richText }, 20, measure)
    expect(result.lines).toEqual([`A${emoji}`, 'B'])
    expect(result.runs[1].x).toBe(10)
  })
})
