import { describe, expect, it } from 'vitest'
import { formatMessage, normalizeLocale } from './core'

describe('normalizeLocale', () => {
  it('maps simplified and traditional Chinese variants', () => {
    expect(normalizeLocale('zh-CN')).toBe('zh-CN')
    expect(normalizeLocale('zh-Hant-HK')).toBe('zh-TW')
    expect(normalizeLocale('zh-TW')).toBe('zh-TW')
  })

  it('falls back to English', () => expect(normalizeLocale('fr-FR')).toBe('en'))
})

describe('formatMessage', () => {
  it('interpolates values and preserves unknown placeholders', () => {
    expect(formatMessage('{{count}} / {{missing}}', { count: 4 })).toBe('4 / {{missing}}')
  })
})
