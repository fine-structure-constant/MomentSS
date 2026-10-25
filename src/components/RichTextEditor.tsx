import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Redo2, Smile, Underline, Undo2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { Markdown } from '@tiptap/markdown'
import type { RichTextDocument, TextAppearance } from '../types'
import { useI18n } from '../i18n'
import { FONT_OPTIONS } from '../lib/fonts'
import { plainTextDocument } from '../lib/richText'
import { EmojiPicker } from './EmojiPicker'

export default function RichTextEditor({ value, onChange }: { value: TextAppearance; onChange: (patch: Partial<TextAppearance>) => void }) {
  const { t } = useI18n()
  const latest = useRef({ value, onChange, label: t('text.content') })
  latest.current = { value, onChange, label: t('text.content') }
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [markdownOpen, setMarkdownOpen] = useState(false)
  const [markdown, setMarkdown] = useState('')
  const id = useId()
  const selection = useRef<{ from: number; to: number } | null>(null)
  const sizeInput = useRef<HTMLInputElement>(null)
  const [sizeDraft, setSizeDraft] = useState(String(value.fontSize))
  const extensions = useMemo(() => [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, codeBlock: false, code: false, horizontalRule: false }), TextStyleKit.configure({ backgroundColor: false, lineHeight: false }), TextAlign.configure({ types: ['paragraph', 'heading'] }), Markdown], [])
  const initialContent = useRef(value.richText ?? plainTextDocument(value.text))
  const editorProps = useMemo(() => ({ attributes: { role: 'textbox', 'aria-label': t('text.content'), 'aria-multiline': 'true', spellcheck: 'false' } }), [t])
  const editor = useEditor({
    extensions,
    content: initialContent.current,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps,
    onUpdate: ({ editor: current }) => {
      const json = current.getJSON()
      const richText = { ...json, type: 'doc', version: 1 } as RichTextDocument
      latest.current.onChange({ richText, text: current.getText({ blockSeparator: '\n' }) })
    },
  }, [])
  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.view.dom.isConnected) return
    // Parent autosave echoes must not replace the active document/selection.
    // Formatting is edited through this editor; a new layer mounts a new instance.
    if (editor.isFocused || editor.getText({ blockSeparator: '\n' }) === value.text) return
    const desired = value.richText ?? plainTextDocument(value.text)
    const { version: _version, ...content } = desired
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) editor.commands.setContent(content, { emitUpdate: false })
    // Updates from this editor already have the same normalized JSON and preserve selection.
  }, [editor, value.richText, value.text])
  const currentSize = editor ? parseFloat(editor.getAttributes('textStyle').fontSize) || value.fontSize : value.fontSize
  useEffect(() => { if (document.activeElement !== sizeInput.current) setSizeDraft(String(Math.round(currentSize))) }, [currentSize, editor?.state.selection.from, editor?.state.selection.to])
  if (!editor) return null
  const currentFont = editor.getAttributes('textStyle').fontFamily || value.fontFamily
  const commitSize = (focus = false) => {
    const size = Math.max(8, Math.min(400, Number(sizeDraft) || currentSize))
    const chain = editor.chain()
    if (focus) chain.focus()
    chain.setFontSize(`${size}px`).run()
    setSizeDraft(String(size))
  }
  const closeEmoji = () => { setEmojiOpen(false); editor.chain().focus().setTextSelection(selection.current ?? editor.state.selection).run() }
  const toggleEmoji = () => {
    if (emojiOpen) { closeEmoji(); return }
    selection.current = { from: editor.state.selection.from, to: editor.state.selection.to }
    setEmojiOpen(true)
  }
  return <div className="rich-editor" style={{ '--text-base-font': `${value.fontSize}px`, '--text-base-family': value.fontFamily, '--text-base-color': value.color, '--text-base-line': value.lineHeight, '--text-base-align': value.align } as CSSProperties} onKeyDown={(event) => {
    if (emojiOpen && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeEmoji() }
  }}>
    <div className="text-content-field__header"><span className="field__label">{t('text.content')}</span><button type="button" className="emoji-trigger" aria-expanded={emojiOpen} aria-controls={id} onClick={toggleEmoji}><Smile size={16} />{t('emoji.title')}</button></div>
    <div className="rich-editor__formats" role="group" aria-label={t('rich.format')}>
      <select aria-label={t('rich.block')} value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('blockquote') ? 'quote' : 'paragraph'} onChange={(event) => {
        const type = event.currentTarget.value
        if (type === 'quote') editor.chain().focus().toggleBlockquote().run()
        else if (type === 'paragraph') editor.chain().focus().setParagraph().run()
        else editor.chain().focus().setHeading({ level: Number(type.slice(1)) as 1 | 2 | 3 }).run()
      }}><option value="paragraph">{t('rich.paragraph')}</option><option value="h1">{t('rich.h1')}</option><option value="h2">{t('rich.h2')}</option><option value="h3">{t('rich.h3')}</option><option value="quote">{t('rich.quote')}</option></select>
      <label className="rich-editor__font"><span className="visually-hidden">{t('text.font')}</span><select value={currentFont} onChange={(event) => editor.chain().focus().setFontFamily(event.currentTarget.value).run()}>{!FONT_OPTIONS.some((font) => font.value === currentFont) && <option value={currentFont}>{t('font.legacy')}</option>}{FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{t(font.label)}</option>)}</select></label>
      <label className="rich-editor__size"><span className="visually-hidden">{t('text.size')}</span><input ref={sizeInput} type="number" min={8} max={400} value={sizeDraft} onChange={(event) => setSizeDraft(event.currentTarget.value)} onBlur={() => commitSize()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitSize(true) } }} /></label>
    </div>
    <div className="rich-editor__tools" role="toolbar" aria-label={t('rich.inline')}>
      <button type="button" aria-label={t('text.bold')} aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={17} /></button>
      <button type="button" aria-label={t('text.italic')} aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={17} /></button>
      <button type="button" aria-label={t('rich.underline')} aria-pressed={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={17} /></button>
      <button type="button" aria-label={t('rich.bullets')} aria-pressed={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={17} /></button>
      <button type="button" aria-label={t('rich.numbers')} aria-pressed={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></button>
      {(['left', 'center', 'right'] as const).map((align) => { const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight; const label = align === 'left' ? 'text.alignLeft' : align === 'center' ? 'text.alignCenter' : 'text.alignRight'; return <button key={align} type="button" aria-label={t(label)} aria-pressed={editor.isActive({ textAlign: align })} onClick={() => editor.chain().focus().setTextAlign(align).run()}><Icon size={17} /></button> })}
      <label className="rich-editor__color"><span className="visually-hidden">{t('text.color')}</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(editor.getAttributes('textStyle').color) ? editor.getAttributes('textStyle').color : value.color} onChange={(event) => editor.chain().focus().setColor(event.currentTarget.value).run()} /></label>
      <button type="button" aria-label={t('common.undo')} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></button>
      <button type="button" aria-label={t('rich.redo')} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></button>
    </div>
    <div className="rich-editor__document"><EditorContent editor={editor} /></div>
    {emojiOpen && <EmojiPicker id={id} onClose={closeEmoji} onInsert={(emoji) => { editor.chain().focus().setTextSelection(selection.current ?? editor.state.selection).insertContent(emoji).run(); setEmojiOpen(false) }} />}
    <p className="rich-editor__hint">{t('rich.hint')}</p>
    <div className="rich-editor__secondary"><button type="button" className="text-button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>{t('rich.clear')}</button><button type="button" className="text-button" aria-expanded={markdownOpen} onClick={() => setMarkdownOpen((open) => !open)}>{t('rich.markdown')}</button></div>
    {markdownOpen && <div className="rich-editor__markdown"><label className="field"><span className="field__label">{t('rich.markdownLabel')}</span><textarea value={markdown} onChange={(event) => setMarkdown(event.currentTarget.value)} rows={5} /></label><p className="section-copy">{t('rich.markdownHint')}</p><button type="button" className="secondary-button" disabled={!markdown.trim()} onClick={() => { editor.commands.setContent(markdown, { contentType: 'markdown' }); setMarkdownOpen(false); editor.commands.focus() }}>{t('rich.applyMarkdown')}</button></div>}
  </div>
}
