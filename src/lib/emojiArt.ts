import assets from './emojiAssets.json'
import { splitGraphemes } from './textInput'
import type { TextAppearance } from '../types'

export const EMOJI_STYLES = ['native', 'twemoji-v17', 'fluent-v1'] as const
const images = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<void>>()
export function emojiArtwork(value: string, style?: string): string | undefined {
  if (!style || style === 'native') return undefined
  return (assets as Record<string, Record<string, string>>)[value]?.[style]
}
export function loadedEmoji(url: string) { return images.get(url) }
export function emojiUrls(styles: TextAppearance[]): string[] {
  return [...new Set(styles.flatMap((style) => splitGraphemes(style.text).map((value) => emojiArtwork(value, style.emojiStyle)).filter((url): url is string => !!url)))]
}
export async function ensureEmojiArt(styles: TextAppearance[]): Promise<void> {
  if (typeof Image === 'undefined') return
  await Promise.all(emojiUrls(styles).map((url) => {
    if (!pending.has(url)) pending.set(url, (async () => {
      const image = new Image(); image.src = url
      await image.decode(); images.set(url, image)
    })().catch((error) => { pending.delete(url); throw error }))
    return pending.get(url)
  }))
}
export function missingEmoji(styles: TextAppearance[]): string[] {
  return [...new Set(styles.flatMap((style) => style.emojiStyle && style.emojiStyle !== 'native' ? splitGraphemes(style.text).filter((value) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value) && !emojiArtwork(value, style.emojiStyle)) : []))]
}
