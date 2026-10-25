import type { ResourceMetadata } from '../types'

export function parseCaptureTime(value: unknown, offset: unknown): Pick<ResourceMetadata, 'capturedAt' | 'capturedLocalTime' | 'capturedOffsetMinutes'> {
  if (typeof value !== 'string') return {}
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value)
  if (!match) return {}
  const [, y, m, d, h, min, s] = match
  const parts = [y, m, d, h, min, s].map(Number)
  const utc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])
  const check = new Date(utc)
  if (check.getUTCFullYear() !== parts[0] || check.getUTCMonth() !== parts[1] - 1 || check.getUTCDate() !== parts[2] || Number(h) > 23 || Number(min) > 59 || Number(s) > 59) return {}
  const capturedLocalTime = `${y}-${m}-${d}T${h}:${min}:${s}`
  const zone = typeof offset === 'string' ? /^([+-])(\d{2}):(\d{2})$/.exec(offset) : null
  if (!zone || Number(zone[2]) > 14 || Number(zone[3]) > 59) return { capturedLocalTime }
  const capturedOffsetMinutes = (Number(zone[2]) * 60 + Number(zone[3])) * (zone[1] === '-' ? -1 : 1)
  return { capturedLocalTime, capturedOffsetMinutes, capturedAt: utc - capturedOffsetMinutes * 60000 }
}

export async function readPhotoMetadata(file: File): Promise<ResourceMetadata> {
  const metadata: ResourceMetadata = { originalName: file.name, importedAt: Date.now(), fileModifiedAt: file.lastModified > 0 ? file.lastModified : undefined }
  if (!/\.(jpe?g|heic|heif|hif|png|avif)$/i.test(file.name) && !/^image\/(jpeg|heic|heif|png|avif)$/.test(file.type)) return metadata
  try {
    const { parse } = await import('exifr')
    const exif = await parse(file, { pick: ['DateTimeOriginal', 'OffsetTimeOriginal', 'CreateDate'], reviveValues: false, gps: false })
    return { ...metadata, ...parseCaptureTime(exif?.DateTimeOriginal ?? exif?.CreateDate, exif?.OffsetTimeOriginal) }
  } catch { return metadata }
}
