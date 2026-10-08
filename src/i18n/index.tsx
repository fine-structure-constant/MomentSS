import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatMessage, normalizeLocale } from './core'
import { en } from './locales/en'
import { zhCN } from './locales/zh-CN'
import { zhTW } from './locales/zh-TW'
import type { Locale, MessageKey, MessageValues } from './types'

const STORAGE_KEY = 'liubai-locale'
const dictionaries = { 'zh-CN': zhCN, 'zh-TW': zhTW, en }

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, values?: MessageValues) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function initialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh-CN' || stored === 'zh-TW' || stored === 'en') return stored
  } catch { /* Browsing can continue when storage is unavailable. */ }
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
  return normalizeLocale(candidates[0])
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const t = useCallback((key: MessageKey, values?: MessageValues) => {
    return formatMessage(dictionaries[locale][key], values)
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* Keep the in-memory choice. */ }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('meta.title')
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', t('meta.description'))
  }, [locale, t])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}

export type { Locale, MessageKey }
