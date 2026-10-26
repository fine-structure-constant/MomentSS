import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { EmojiPicker } from './EmojiPicker'

export function EmojiPopover({ anchor, id, onClose, onInsert, style }: { anchor: RefObject<HTMLButtonElement | null>; id: string; onClose: () => void; onInsert: (text: string) => void; style?: string }) {
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 360, width: 340 })
  useLayoutEffect(() => {
    const place = () => {
      const viewport = window.visualViewport
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight, offset = viewport?.offsetTop ?? 0
      const rect = anchor.current?.getBoundingClientRect()
      const panelWidth = Math.min(340, width - 16), panelHeight = Math.min(380, height - 24)
      setPosition({ width: panelWidth, maxHeight: panelHeight, left: Math.max(8, Math.min((rect?.right ?? width) - panelWidth, width - panelWidth - 8)), top: width < 600 ? offset + height - panelHeight - 8 : Math.max(offset + 8, Math.min((rect?.bottom ?? offset) + 6, offset + height - panelHeight - 8)) })
    }
    const outside = (event: globalThis.PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose() }
    place()
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place)
    document.addEventListener('pointerdown', outside)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place); document.removeEventListener('pointerdown', outside) }
  }, [anchor, onClose])
  const owner = anchor.current?.closest('[role="dialog"]') ?? document.body
  return createPortal(<div ref={panel} className="emoji-popover" style={{ position: 'fixed', ...position }}><EmojiPicker id={id} onClose={onClose} onInsert={onInsert} style={style} /></div>, owner)
}
