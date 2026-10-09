import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Smile } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { TextAlign, TextAppearance } from '../types'
import { RangeField } from './Fields'
import { useI18n, type MessageKey } from '../i18n'
import { EmojiPicker } from './EmojiPicker'
import { insertAtSelection } from '../lib/textInput'

const FONT_OPTIONS = [
  { label: 'text.fontRounded', value: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif' },
  { label: 'text.fontSans', value: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif' },
  { label: 'text.fontSerif', value: '"Songti SC", SimSun, serif' },
  { label: 'text.fontHand', value: 'KaiTi, "STKaiti", serif' },
]

interface TextControlsProps {
  value: TextAppearance
  onChange: (patch: Partial<TextAppearance>) => void
}

export function TextControls({ value, onChange }: TextControlsProps) {
  const { t } = useI18n()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const selection = useRef({ start: value.text.length, end: value.text.length })
  const pendingCaret = useRef<number | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const pickerId = useId()
  const captureSelection = () => {
    const input = textRef.current
    if (input) selection.current = { start: input.selectionStart, end: input.selectionEnd }
  }
  const closeEmoji = () => { setEmojiOpen(false); textRef.current?.focus({ preventScroll: true }) }
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !textRef.current) return
    const caret = pendingCaret.current
    pendingCaret.current = null
    textRef.current.focus({ preventScroll: true })
    textRef.current.setSelectionRange(caret, caret)
    selection.current = { start: caret, end: caret }
  })
  const alignment: Array<{ value: TextAlign; icon: typeof AlignLeft; label: MessageKey }> = [
    { value: 'left', icon: AlignLeft, label: 'text.alignLeft' },
    { value: 'center', icon: AlignCenter, label: 'text.alignCenter' },
    { value: 'right', icon: AlignRight, label: 'text.alignRight' },
  ]

  return (
    <>
      <div className="text-content-field" onKeyDown={(event) => {
        if (emojiOpen && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeEmoji() }
      }}>
        <div className="text-content-field__header"><label className="field__label" htmlFor={`${pickerId}-text`}>{t('text.content')}</label><button type="button" className="emoji-trigger" aria-expanded={emojiOpen} aria-controls={pickerId} onClick={() => setEmojiOpen((open) => !open)}><Smile size={16} />{t('emoji.title')}</button></div>
        <textarea ref={textRef} id={`${pickerId}-text`} rows={3} value={value.text} onSelect={captureSelection} onBlur={captureSelection} onChange={(event) => { onChange({ text: event.currentTarget.value }); captureSelection() }} />
        {emojiOpen && <EmojiPicker id={pickerId} onClose={closeEmoji} onInsert={(emoji) => {
          const next = insertAtSelection(value.text, emoji, selection.current)
          pendingCaret.current = next.caret
          onChange({ text: next.text })
          setEmojiOpen(false)
        }} />}
      </div>
      <label className="field">
        <span className="field__label">{t('text.font')}</span>
        <select value={value.fontFamily} onChange={(event) => onChange({ fontFamily: event.currentTarget.value })}>
          {FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{t(font.label as MessageKey)}</option>)}
        </select>
      </label>
      <div className="control-row">
        <button type="button" className={`icon-toggle ${value.fontWeight >= 600 ? 'is-active' : ''}`} aria-pressed={value.fontWeight >= 600} onClick={() => onChange({ fontWeight: value.fontWeight >= 600 ? 400 : 700 })}><Bold size={18} /><span className="visually-hidden">{t('text.bold')}</span></button>
        <button type="button" className={`icon-toggle ${value.italic ? 'is-active' : ''}`} aria-pressed={value.italic} onClick={() => onChange({ italic: !value.italic })}><Italic size={18} /><span className="visually-hidden">{t('text.italic')}</span></button>
        <div className="segmented compact-segment" aria-label={t('text.alignment')}>
          {alignment.map(({ value: align, icon: Icon, label }) => (
            <button key={align} type="button" className={value.align === align ? 'is-active' : ''} aria-label={t(label)} aria-pressed={value.align === align} onClick={() => onChange({ align })}><Icon size={18} /></button>
          ))}
        </div>
      </div>
      <div className="color-row">
        <label><span>{t('text.color')}</span><input type="color" value={normalizeColor(value.color, '#10223d')} onChange={(event) => onChange({ color: event.currentTarget.value })} /></label>
        <label><span>{t('text.background')}</span><input type="color" value={normalizeColor(value.background, '#ffffff')} onChange={(event) => onChange({ background: event.currentTarget.value })} /></label>
      </div>
      <RangeField label={t('text.size')} value={value.fontSize} min={24} max={128} suffix="px" onChange={(fontSize) => onChange({ fontSize })} />
      <RangeField label={t('text.rotation')} value={value.rotation} min={-12} max={12} suffix="°" onChange={(rotation) => onChange({ rotation })} />
      <RangeField label={t('text.lineHeight')} value={value.lineHeight} min={1} max={2} step={0.05} suffix="×" onChange={(lineHeight) => onChange({ lineHeight })} />
    </>
  )
}

function normalizeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}
