import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IMAGE_ACCEPT, isHeifFile, isImportableImage, prepareImageFile } from './imageImport'

const { convert } = vi.hoisted(() => ({ convert: vi.fn() }))
vi.mock('heic-to/csp', () => ({ heicTo: convert }))

function container(major: string, compatible: string[] = []): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16 + compatible.length * 4)
  new DataView(bytes.buffer).setUint32(0, bytes.length)
  bytes.set(new TextEncoder().encode(`ftyp${major}`), 4)
  compatible.forEach((brand, index) => bytes.set(new TextEncoder().encode(brand), 16 + index * 4))
  return bytes
}

describe('HEIF image imports', () => {
  beforeEach(() => { convert.mockReset() })

  it('accepts Apple filename extensions and MIME types, including empty or generic MIME', async () => {
    for (const name of ['IMG_0001.HEIC', 'photo.heif', 'photo.hif', 'burst.heics', 'burst.heifs']) {
      const file = new File([], name, { type: 'application/octet-stream' })
      expect(await isHeifFile(file)).toBe(true)
      expect(await isImportableImage(file)).toBe(true)
      expect(IMAGE_ACCEPT).toContain(`.${name.split('.').at(-1)?.toLowerCase()}`)
    }
    expect(await isHeifFile(new File([], 'photo', { type: 'image/heif' }))).toBe(true)
  })

  it('detects HEIF file contents without a recognized extension or MIME', async () => {
    const file = new File([container('mif1', ['heic'])], 'photo', { type: '' })
    expect(await isHeifFile(file)).toBe(true)
    expect(await isImportableImage(file)).toBe(true)
    expect(await isHeifFile(new File([container('zzzz', ['heix'])], 'photo'))).toBe(true)
  })

  it('keeps AVIF with shared generic HEIF brands on the normal browser path', async () => {
    const file = new File([container('mif1', ['avif'])], 'photo.avif', { type: 'image/avif' })
    expect(await isHeifFile(file)).toBe(false)
    expect(await prepareImageFile(file)).toBe(file)
    expect(convert).not.toHaveBeenCalled()
  })

  it('normalizes HEIF to lossless PNG for reusable resources', async () => {
    const file = new File([container('heic')], 'apple.HEIC')
    const png = new Blob(['decoded pixels'], { type: 'image/png' })
    convert.mockResolvedValue(png)
    expect(await prepareImageFile(file)).toBe(png)
    expect(convert).toHaveBeenCalledExactlyOnceWith({ blob: file, type: 'image/png' })
    expect(file.name).toBe('apple.HEIC')
  })

  it('leaves normal images intact and rejects non-image files in batch filtering', async () => {
    const jpeg = new File(['image'], 'photo.jpg')
    expect(await isImportableImage(jpeg)).toBe(true)
    expect(await prepareImageFile(jpeg)).toBe(jpeg)
    expect(await isImportableImage(new File(['text'], 'notes.txt'))).toBe(false)
    expect(await isHeifFile(new File(['ftypheic'], 'broken'))).toBe(false)
    expect(convert).not.toHaveBeenCalled()
  })

  it('propagates decode errors so the UI reports failure and allows another import', async () => {
    const error = new Error('Invalid HEIF data')
    convert.mockRejectedValue(error)
    await expect(prepareImageFile(new File(['broken'], 'bad.heic'))).rejects.toBe(error)
  })
})
