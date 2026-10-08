/** Keep MIME types and extensions: some operating systems give HEIF files an empty MIME type. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/svg+xml,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.heic,.heif,.hif,.heics,.heifs'

const HEIF_EXTENSION = /\.(?:heic|heif|hif|heics|heifs)$/i
const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp|avif|svg|gif|bmp)$/i
const HEIF_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])

export async function isHeifFile(file: File): Promise<boolean> {
  if (HEIF_EXTENSION.test(file.name) || HEIF_TYPES.has(file.type.toLowerCase())) return true

  // Read only the file-type box, not a whole multi-megabyte photo, to detect files without metadata.
  const bytes = new Uint8Array(await file.slice(0, 256).arrayBuffer())
  const brandAt = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (bytes.length < 16 || brandAt(4) !== 'ftyp') return false
  const size = new DataView(bytes.buffer).getUint32(0)
  if (size < 16) return false
  const brands = [brandAt(8)]
  for (let offset = 16; offset + 4 <= Math.min(size, bytes.length); offset += 4) brands.push(brandAt(offset))
  // AVIF can share the generic mif1 HEIF brand; let the browser decode it normally.
  if (brands.some((brand) => brand === 'avif' || brand === 'avis')) return false
  return brands.some((brand) => HEIF_BRANDS.has(brand))
}

export async function isImportableImage(file: File): Promise<boolean> {
  return file.type.startsWith('image/') || IMAGE_EXTENSION.test(file.name) || await isHeifFile(file)
}

/** Normalize once on import so thumbnails, stored resources and all exports use the same pixels. */
export async function prepareImageFile(file: File): Promise<Blob> {
  if (!await isHeifFile(file)) return file
  // The codec and its worker are bundled with the app, loaded only for a HEIF import.
  const { heicTo } = await import('heic-to/csp')
  // Lossless PNG avoids another lossy JPEG encoding before the user's final export.
  return heicTo({ blob: file, type: 'image/png' })
}
