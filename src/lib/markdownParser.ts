import { MarkdownManager } from '@tiptap/markdown'
import type { AnyExtension } from '@tiptap/core'
/** The parser shares the editor schema; it never injects raw rendered HTML. */
export function parseMarkdown(source: string, extensions: AnyExtension[]) {
  return new MarkdownManager({ extensions }).parse(source)
}
