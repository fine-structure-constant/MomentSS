import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../i18n'
import { EMOJI_CATEGORIES, EMOJI_ENTRIES, readRecentEmoji, rememberEmoji, searchEmoji, type EmojiCategory, type EmojiEntry } from '../lib/emoji'

export function EmojiPicker({ id, onInsert, onClose }: { id: string; onInsert: (emoji: string) => void; onClose: () => void }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<EmojiCategory>('faces')
  const [recent] = useState(readRecentEmoji)
  const search = useRef<HTMLInputElement>(null)
  const results = searchEmoji(query, category)
  useEffect(() => { search.current?.focus({ preventScroll: true }) }, [])
  const grid = (entries: EmojiEntry[]) => <div className="emoji-picker__grid">{entries.map((entry) => <button
    key={entry.value} type="button" title={entry.names[locale]}
    aria-label={t('emoji.insert', { emoji: entry.value, name: entry.names[locale] })}
    onClick={() => { rememberEmoji(entry.value); onInsert(entry.value) }}
  >{entry.value}</button>)}</div>

  return <section id={id} className="emoji-picker" aria-label={t('emoji.title')} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
  }}>
    <div className="emoji-picker__header"><label className="field"><span className="visually-hidden">{t('emoji.search')}</span><input ref={search} type="search" value={query} placeholder={t('emoji.searchPlaceholder')} onChange={(event) => setQuery(event.currentTarget.value)} /></label><button type="button" className="icon-button" onClick={onClose} aria-label={t('emoji.close')}><X size={16} /></button></div>
    <div className="emoji-picker__categories" aria-label={t('emoji.categories')}>{EMOJI_CATEGORIES.map((value) => <button key={value} type="button" aria-pressed={!query.trim() && category === value} onClick={() => { setCategory(value); setQuery('') }}>{t(`emoji.${value}`)}</button>)}</div>
    {!query.trim() && recent.length > 0 && <div className="emoji-picker__recent"><p>{t('emoji.recent')}</p>{grid(recent.map((value) => EMOJI_ENTRIES.find((entry) => entry.value === value)!))}</div>}
    <div className="emoji-picker__results" aria-live="polite">{results.length ? grid(results) : <p className="emoji-picker__empty">{t('emoji.empty')}</p>}</div>
  </section>
}
