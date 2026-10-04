import { AlertTriangle, Check, Info } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'warning'

export interface ToastMessage {
  text: string
  tone: ToastTone
}

export function StatusToast({ message }: { message: ToastMessage | null }) {
  if (!message) return null
  const Icon = message.tone === 'success' ? Check : message.tone === 'warning' ? AlertTriangle : Info
  return (
    <div className={`status-toast status-toast--${message.tone}`} role="status">
      <Icon aria-hidden="true" size={18} />
      <span>{message.text}</span>
    </div>
  )
}
