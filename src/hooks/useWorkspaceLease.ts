import { useEffect, useState } from 'react'

/** Only the owner mounts editors/autosave. A second tab cannot silently overwrite it. */
export function useWorkspaceLease() {
  const [state, setState] = useState<'waiting' | 'owned' | 'busy' | 'unsupported'>('waiting')
  useEffect(() => {
    let disposed = false, release: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined, attempts = 0
    const lifetime = new Promise<void>((resolve) => { release = resolve })
    if (navigator.locks) {
      const acquire = () => { void navigator.locks.request('momentss-workspace-writer', { ifAvailable: true }, async (lock) => {
        if (disposed) return
        if (!lock) { if (++attempts < 4) timer = setTimeout(acquire, 80); else setState('busy'); return }
        setState('owned'); await lifetime
      }).catch(() => { if (!disposed) setState('unsupported') }) }
      acquire()
    } else {
      // A non-atomic heartbeat fallback could briefly grant two writers. Do not risk it.
      setState('unsupported')
    }
    return () => { disposed = true; clearTimeout(timer); release?.() }
  }, [])
  return state
}
