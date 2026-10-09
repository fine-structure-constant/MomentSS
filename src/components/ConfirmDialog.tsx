import { AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'

export interface ConfirmOptions {
  title: string
  body: string
  confirmLabel: string
  tone?: 'danger' | 'default'
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, body, confirmLabel, tone = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useI18n()
  const panel = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel()
    }}>
      <section
        ref={panel}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onCancel()
            return
          }
          if (event.key !== 'Tab') return
          const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
          const first = controls[0]
          const last = controls.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
      >
        <div className="confirm-dialog__head">
          {tone === 'danger' && <span className="confirm-dialog__mark" aria-hidden="true"><AlertTriangle size={18} /></span>}
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>
        <p id="confirm-dialog-body">{body}</p>
        <div className="confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="secondary-button" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className={tone === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

/**
 * Promise-based confirmation so callers keep their linear control flow instead of
 * juggling dialog state. Replaces `window.confirm`, which cannot carry the design system.
 */
export function useConfirmDialog(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [request, setRequest] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current = resolve
    setRequest(options)
  }), [])

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setRequest(null)
  }, [])

  const dialog = request
    ? <ConfirmDialog {...request} onCancel={() => settle(false)} onConfirm={() => settle(true)} />
    : null

  return { confirm, dialog }
}
