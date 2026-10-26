import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Smile } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { TextAppearance } from '../types'
import { useI18n } from '../i18n'
import { FONT_OPTIONS } from '../lib/fonts'
import { plainTextDocument } from '../lib/richText'
import { insertAtSelection } from '../lib/textInput'
import { isLightText } from '../lib/editorDocument'
import { EmojiPopover } from './EmojiPopover'

export function BasicTextEditor({ value, onChange, readOnly = false, onFocus }: { value: TextAppearance; onChange: (patch: Partial<TextAppearance>) => void; readOnly?: boolean; onFocus?: () => void }) {
  const { t } = useI18n(), input = useRef<HTMLTextAreaElement>(null), anchor = useRef<HTMLButtonElement>(null), id = useId()
  const selection = useRef({ start: 0, end: 0 }), [emoji, setEmoji] = useState(false)
  const [sizeDraft, setSizeDraft] = useState(String(value.fontSize)), sizeInput = useRef<HTMLInputElement>(null)
  useEffect(() => { if (document.activeElement !== sizeInput.current) setSizeDraft(String(value.fontSize)) }, [value.fontSize])
  const commitSize = () => { const fontSize = Math.max(8, Math.min(400, Number(sizeDraft) || value.fontSize)); onChange({ fontSize }); setSizeDraft(String(fontSize)) }
  const close = () => { setEmoji(false); input.current?.focus(); input.current?.setSelectionRange(selection.current.start, selection.current.end) }
  const update = (text: string) => onChange({ text, ...(value.richText ? { richText: plainTextDocument(text) } : {}) })
  return <div className="basic-text-editor">
    <div className="text-content-field__header"><span className="field__label">{t('text.content')}</span><button ref={anchor} className="emoji-trigger" disabled={readOnly} aria-expanded={emoji} aria-controls={id} onClick={() => { if (emoji) close(); else { selection.current = { start: input.current?.selectionStart ?? value.text.length, end: input.current?.selectionEnd ?? value.text.length }; setEmoji(true) } }}><Smile size={16} />{t('emoji.title')}</button></div>
    <textarea ref={input} aria-label={t('text.content')} readOnly={readOnly} className={isLightText(value.color) ? 'editor-light-text' : ''} style={{ color: value.color, fontWeight: value.fontWeight, fontStyle: value.italic ? 'italic' : 'normal', textAlign: value.align }} value={value.text} onChange={(event) => update(event.currentTarget.value)} onFocus={onFocus} spellCheck={false} />
    {!readOnly && <><div className="basic-text-formats"><label><span className="visually-hidden">{t('text.font')}</span><select aria-label={t('text.font')} value={value.fontFamily} onChange={(event) => onChange({ fontFamily: event.currentTarget.value })}>{!FONT_OPTIONS.some((font) => font.value === value.fontFamily) && <option value={value.fontFamily}>{t('font.legacy')}</option>}{FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{t(font.label)}</option>)}</select></label><label><span className="visually-hidden">{t('text.size')}</span><input aria-label={t('text.size')} ref={sizeInput} type="number" min={8} max={400} value={sizeDraft} onChange={(event) => setSizeDraft(event.currentTarget.value)} onBlur={commitSize} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitSize() } }} /></label></div>
    <div className="rich-editor__tools" role="toolbar" aria-label={t('rich.inline')}><button aria-label={t('text.bold')} aria-pressed={value.fontWeight >= 600} onClick={() => onChange({ fontWeight: value.fontWeight >= 600 ? 400 : 700 })}><Bold size={17} /></button><button aria-label={t('text.italic')} aria-pressed={value.italic} onClick={() => onChange({ italic: !value.italic })}><Italic size={17} /></button>{(['left', 'center', 'right'] as const).map((align) => { const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight; return <button key={align} aria-label={t(align === 'left' ? 'text.alignLeft' : align === 'center' ? 'text.alignCenter' : 'text.alignRight')} aria-pressed={value.align === align} onClick={() => onChange({ align })}><Icon size={17} /></button> })}<label className="rich-editor__color"><span className="visually-hidden">{t('text.color')}</span><input aria-label={t('text.color')} type="color" value={/^#[0-9a-f]{6}$/i.test(value.color) ? value.color : '#10243d'} onChange={(event) => onChange({ color: event.currentTarget.value })} /></label></div></>}
    {emoji && <EmojiPopover anchor={anchor} id={id} style={value.emojiStyle} onClose={close} onInsert={(text) => { const next = insertAtSelection(value.text, text, selection.current); update(next.text); setEmoji(false); requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.caret, next.caret) }) }} />}
  </div>
}
