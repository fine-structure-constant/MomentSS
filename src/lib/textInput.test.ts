import { describe, expect, it } from 'vitest'
import { insertAtSelection, splitGraphemes } from './textInput'
import { createTextBlock } from './defaults'
import { wrapLayoutText } from './stitchLayout'
import { EMOJI_ENTRIES, searchEmoji } from './emoji'

describe('emoji input and layout', () => {
  it('inserts at a caret and reports the DOM UTF-16 offset for continued typing', () => {
    expect(insertAtSelection('旅途记录', '🏖️', { start: 2, end: 2 })).toEqual({ text: '旅途🏖️记录', caret: 5 })
    expect(insertAtSelection('', '😀', { start: 0, end: 0 })).toEqual({ text: '😀', caret: 2 })
  })
  it('replaces selected content including emoji and preserves the unselected text', () => {
    expect(insertAtSelection('A🌊海边B', '❤️', { start: 1, end: 5 })).toEqual({ text: 'A❤️B', caret: 3 })
  })
  it('protects joined sequences from an offset inside a grapheme', () => {
    const family = '👨‍👩‍👧‍👦'
    expect(insertAtSelection(`A${family}B`, '✨', { start: 4, end: 4 }).text).toBe(`A✨${family}B`)
    expect(insertAtSelection(`A${family}B`, '✨', { start: 3, end: 6 }).text).toBe('A✨B')
  })
  it('keeps families, flags, skin tones and variation selectors intact when wrapping', () => {
    const parts = ['👨‍👩‍👧‍👦', '🇨🇳', '👍🏽', '🏖️', '❤️']
    expect(splitGraphemes(parts.join(''))).toEqual(parts)
    expect(wrapLayoutText(parts.join(''), 10, createTextBlock(''), (text) => splitGraphemes(text).length * 10)).toEqual(parts)
    expect(wrapLayoutText('海🌊\n\n旅途', 20, createTextBlock(''), (text) => splitGraphemes(text).length * 10)).toEqual(['海🌊', '', '旅途'])
  })
  it('searches across categories and languages, with an explicit empty result', () => {
    expect(searchEmoji('海浪', 'faces').map((entry) => entry.value)).toEqual(['🌊'])
    expect(searchEmoji('櫻花', 'faces').map((entry) => entry.value)).toEqual(['🌸'])
    expect(searchEmoji(' FAMILY ', 'food').map((entry) => entry.value)).toEqual(['👨‍👩‍👧‍👦'])
    expect(searchEmoji('🌊', 'food').map((entry) => entry.value)).toEqual(['🌊'])
    expect(searchEmoji('not-an-emoji', 'faces')).toEqual([])
    expect(searchEmoji('', 'travel').every((entry) => entry.category === 'travel')).toBe(true)
    expect(new Set(EMOJI_ENTRIES.map((entry) => entry.value)).size).toBe(EMOJI_ENTRIES.length)
  })
})
