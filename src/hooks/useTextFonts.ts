import { useEffect, useState } from 'react'
import type { TextAppearance } from '../types'
import { ensureTextFonts, fontFamilies } from '../lib/fonts'

export function useTextFonts(styles: TextAppearance[]) {
  const [state, setState] = useState({ revision: 0, loading: false, error: false })
  const key = JSON.stringify(fontFamilies(styles))
  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: false }))
    void ensureTextFonts(styles).then(() => { if (active) setState((current) => ({ revision: current.revision + 1, loading: false, error: false })) })
      .catch(() => { if (active) setState((current) => ({ ...current, loading: false, error: true })) })
    return () => { active = false }
    // Text changes with the same font reuse cached font files; rich marks may add a family.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}
