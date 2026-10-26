import { useEffect, useRef, useState } from 'react'
export function useVisibility() {
  const ref = useRef<HTMLSpanElement>(null), [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '500px' })
    observer.observe(ref.current); return () => observer.disconnect()
  }, [])
  return { ref, visible }
}
