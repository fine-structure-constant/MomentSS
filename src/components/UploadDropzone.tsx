import { ImagePlus, LockKeyhole } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { IMAGE_ACCEPT } from '../lib/imageImport'

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void | Promise<void>
  multiple?: boolean
  compact?: boolean
  label?: string
}

export function UploadDropzone({
  onFiles,
  multiple = false,
  compact = false,
  label,
}: UploadDropzoneProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)

  const commitFiles = async (list: FileList | null) => {
    if (!list?.length || reading) return
    setReading(true)
    try {
      await onFiles(Array.from(list))
    } finally {
      if (inputRef.current) inputRef.current.value = ''
      setReading(false)
    }
  }

  return (
    <div
      className={`dropzone ${compact ? 'dropzone--compact' : ''} ${dragging ? 'is-dragging' : ''}`}
      aria-busy={reading}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void commitFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={reading}
        multiple={multiple}
        onChange={(event) => void commitFiles(event.currentTarget.files)}
      />
      <ImagePlus aria-hidden="true" size={compact ? 20 : 28} strokeWidth={1.8} />
      <div>
        <button type="button" className="dropzone__button" disabled={reading} onClick={() => inputRef.current?.click()}>
          {reading ? t('upload.reading') : label ?? t('upload.default')}
        </button>
        {!compact && <p>{t('upload.formats')}</p>}
      </div>
      {!compact && (
        <span className="privacy-line"><LockKeyhole aria-hidden="true" size={14} /> {t('upload.private')}</span>
      )}
    </div>
  )
}
