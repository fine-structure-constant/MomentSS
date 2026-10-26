import { describe, expect, it } from 'vitest'
import { createTextBlock } from './defaults'
import { isLightText, requiresRichEditor } from './editorDocument'
import { plainTextDocument } from './richText'

describe('core editor preserves document semantics', () => {
  it('accepts unformatted documents and uses an immediate system font for new content', () => {
    const text = createTextBlock('hello\nworld')
    expect(text.fontFamily).toContain('system-ui')
    expect(requiresRichEditor(text)).toBe(false)
    expect(requiresRichEditor({ ...text, richText: plainTextDocument(text.text) })).toBe(false)
  })
  it('requires advanced editing for marks, paragraph styles, headings and lists', () => {
    const text = createTextBlock('hello')
    for (const content of [
      [{ type: 'paragraph', content: [{ type: 'text', text: 'hello', marks: [{ type: 'bold' }] }] }],
      [{ type: 'paragraph', attrs: { textAlign: 'right' } }],
      [{ type: 'heading', attrs: { level: 1 } }],
      [{ type: 'bulletList', content: [] }],
    ]) expect(requiresRichEditor({ ...text, richText: { type: 'doc', version: 1, content } })).toBe(true)
  })
  it('adds an editing aid only to light colors', () => {
    expect(isLightText('#ffffff')).toBe(true)
    expect(isLightText('rgb(240, 240, 240)')).toBe(true)
    expect(isLightText('#10223d')).toBe(false)
  })
})
