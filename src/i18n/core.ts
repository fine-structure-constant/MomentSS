import type { Locale, MessageValues } from './types'

export function normalizeLocale(input?: string | null): Locale {
  const value = (input ?? '').toLowerCase()
  if (value === 'zh-tw' || value.startsWith('zh-hant') || value.startsWith('zh-hk') || value.startsWith('zh-mo')) return 'zh-TW'
  if (value.startsWith('zh')) return 'zh-CN'
  return 'en'
}

export function formatMessage(template: string, values: MessageValues = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => key in values ? String(values[key]) : match)
}
