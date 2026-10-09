import { AlertTriangle, Check, Info, Undo2 } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'warning'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ToastMessage {
  text: string
  tone: ToastTone
  /** Optional single action, used for reversible destructive operations. */
  action?: ToastAction
}

export function StatusToast({ message, onDismiss }: { message: ToastMessage | null; onDismiss?: () => void }) {
  if (!message) return null
  const Icon = message.tone === 'success' ? Check : message.tone === 'warning' ? AlertTriangle : Info
  return (
    <div className={`status-toast status-toast--${message.tone}`} role="status">
      <Icon aria-hidden="true" size={18} />
      <span>{message.text}</span>
      {message.action && (
        <button
          type="button"
          className="status-toast__action"
          onClick={() => { message.action?.onAction(); onDismiss?.() }}
        >
          <Undo2 aria-hidden="true" size={15} />{message.action.label}
        </button>
      )}
    </div>
  )
}
