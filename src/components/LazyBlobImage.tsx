import { useEffect, useRef, useState } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'

/** Offscreen cards hold Blob references, but don't decode original images. */
export function LazyBlobImage({ blob }: { blob: Blob }) {
  const root = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } }, { rootMargin: '160px' })
    observer.observe(root.current); return () => observer.disconnect()
  }, [])
  const url = useObjectUrl(visible ? blob : null)
  return <span ref={root} className="lazy-blob-image">{url && <img src={url} alt="" loading="lazy" decoding="async" />}</span>
}
