import type { ReactNode } from 'react'

interface RangeFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  /** Set when the control has nothing to act on, so it reads as unavailable instead of broken. */
  disabled?: boolean
  note?: string
  onChange: (value: number) => void
}

export function RangeField({ label, value, min, max, step = 1, suffix = '', disabled = false, note, onChange }: RangeFieldProps) {
  return (
    <label className={`field range-field ${disabled ? 'is-disabled' : ''}`}>
      <span className="field__label"><span>{label}</span><output>{value}{suffix}</output></span>
      <input
        type="range"
        aria-label={label}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {note && <span className="field__note">{note}</span>}
    </label>
  )
}

interface FieldGroupProps {
  title: string
  children: ReactNode
  actions?: ReactNode
}

export function FieldGroup({ title, children, actions }: FieldGroupProps) {
  return (
    <section className="field-group">
      <div className="field-group__head"><h3>{title}</h3>{actions}</div>
      <div className="field-group__body">{children}</div>
    </section>
  )
}
