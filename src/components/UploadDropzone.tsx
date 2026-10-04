import { ImagePlus, LockKeyhole } from 'lucide-react'
import { useRef, useState } from 'react'

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
  label = '拖入照片，或选择文件',
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const commitFiles = (list: FileList | null) => {
    if (!list?.length) return
    void onFiles(Array.from(list))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      className={`dropzone ${compact ? 'dropzone--compact' : ''} ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        commitFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        multiple={multiple}
        onChange={(event) => commitFiles(event.currentTarget.files)}
      />
      <ImagePlus aria-hidden="true" size={compact ? 20 : 28} strokeWidth={1.8} />
      <div>
        <button type="button" className="dropzone__button" onClick={() => inputRef.current?.click()}>
          {label}
        </button>
        {!compact && <p>支持 JPG、PNG、WebP、AVIF</p>}
      </div>
      {!compact && (
        <span className="privacy-line"><LockKeyhole aria-hidden="true" size={14} /> 图片不会离开此设备</span>
      )}
    </div>
  )
}
