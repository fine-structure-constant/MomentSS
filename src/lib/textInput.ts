const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function splitGraphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment)
}

/** DOM selections use UTF-16 offsets; never insert inside a joined emoji. */
export function insertAtSelection(text: string, inserted: string, selection: { start: number; end: number }) {
  const boundaries = [0]
  for (const part of splitGraphemes(text)) boundaries.push(boundaries[boundaries.length - 1] + part.length)
  const start = Math.max(0, Math.min(text.length, selection.start))
  const end = Math.max(start, Math.min(text.length, selection.end))
  const from = boundaries.filter((offset) => offset <= start).at(-1) ?? 0
  const to = end === start ? from : boundaries.find((offset) => offset >= end) ?? text.length
  return { text: text.slice(0, from) + inserted + text.slice(to), caret: from + inserted.length }
}
