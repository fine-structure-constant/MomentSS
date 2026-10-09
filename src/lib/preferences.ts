import type { PhotoOverlay, TextAlign, TextAppearance } from '../types'

/**
 * Remembers the last text and photo-overlay styling so new blocks start from what the
 * user just set instead of the hard-coded defaults. Preferences are a convenience only:
 * unreadable or tampered values fall back to the defaults and never block editing.
 */
const TEXT_STYLE_KEY = 'liubai-text-style'
const OVERLAY_STYLE_KEY = 'liubai-overlay-style'

export type TextStylePreset = Pick<TextAppearance, 'color' | 'background' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic' | 'align' | 'rotation' | 'lineHeight'>
export type OverlayStylePreset = TextStylePreset & Pick<PhotoOverlay, 'width' | 'backgroundOpacity' | 'boxPadding' | 'borderStyle' | 'borderWidth' | 'borderColor' | 'borderRadius'>

const ALIGNMENTS: TextAlign[] = ['left', 'center', 'right']
const BORDER_STYLES: NonNullable<PhotoOverlay['borderStyle']>[] = ['none', 'solid', 'dashed', 'dotted']
const WEIGHTS: TextAppearance['fontWeight'][] = [400, 600, 700]

type Validator = (value: unknown) => boolean

const isText = (value: unknown): boolean => typeof value === 'string'
const isFont = (value: unknown): boolean => typeof value === 'string' && value.length > 0 && value.length <= 200
const isNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value)

function bounded(min: number, max: number): Validator {
  return (value) => isNumber(value) && (value as number) >= min && (value as number) <= max
}

function oneOf<T>(options: T[]): Validator {
  return (value) => options.includes(value as T)
}

const TEXT_FIELDS: Array<[keyof TextStylePreset, Validator]> = [
  ['color', (value) => isText(value) && /^#[0-9a-f]{6}$/i.test(value as string)],
  ['background', (value) => isText(value) && /^#[0-9a-f]{6}$/i.test(value as string)],
  ['fontFamily', isFont],
  ['fontSize', bounded(8, 400)],
  ['fontWeight', oneOf(WEIGHTS)],
  ['italic', (value) => typeof value === 'boolean'],
  ['align', oneOf(ALIGNMENTS)],
  ['rotation', bounded(-180, 180)],
  ['lineHeight', bounded(0.6, 4)],
]

const OVERLAY_FIELDS: Array<[keyof OverlayStylePreset, Validator]> = [
  ...TEXT_FIELDS as Array<[keyof OverlayStylePreset, Validator]>,
  ['width', bounded(0.1, 1)],
  ['backgroundOpacity', bounded(0, 100)],
  ['boxPadding', bounded(0, 400)],
  ['borderStyle', oneOf(BORDER_STYLES)],
  ['borderWidth', bounded(0, 64)],
  ['borderColor', (value) => isText(value) && /^#[0-9a-f]{6}$/i.test(value as string)],
  ['borderRadius', bounded(0, 400)],
]

function pick<T extends object>(raw: string | null, fields: Array<[keyof T, Validator]>): Partial<T> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    const result: Partial<T> = {}
    let matched = 0
    for (const [key, isValid] of fields) {
      if (isValid(record[key as string])) {
        result[key] = record[key as string] as T[keyof T]
        matched += 1
      }
    }
    return matched > 0 ? result : null
  } catch {
    return null
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: object): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Editing still works when browser storage is unavailable. */
  }
}

function project<T extends object>(source: Partial<T>, fields: Array<[keyof T, Validator]>): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, isValid] of fields) {
    const value = source[key]
    if (isValid(value)) result[key] = value as T[keyof T]
  }
  return result
}

export function readTextStylePreset(): Partial<TextStylePreset> | null {
  return pick<TextStylePreset>(read(TEXT_STYLE_KEY), TEXT_FIELDS)
}

export function readOverlayStylePreset(): Partial<OverlayStylePreset> | null {
  return pick<OverlayStylePreset>(read(OVERLAY_STYLE_KEY), OVERLAY_FIELDS)
}

/** Keeps only the reusable styling keys of an edited block. */
export function pickTextStyle(style: Partial<TextAppearance>): Partial<TextStylePreset> {
  return project<TextStylePreset>(style as Partial<TextStylePreset>, TEXT_FIELDS)
}

export function pickOverlayStyle(style: Partial<PhotoOverlay>): Partial<OverlayStylePreset> {
  return project<OverlayStylePreset>(style as Partial<OverlayStylePreset>, OVERLAY_FIELDS)
}

export function rememberTextStyle(style: Partial<TextAppearance>): void {
  const preset = pickTextStyle(style)
  if (Object.keys(preset).length) write(TEXT_STYLE_KEY, preset)
}

export function rememberOverlayStyle(style: Partial<PhotoOverlay>): void {
  const preset = pickOverlayStyle(style)
  if (Object.keys(preset).length) write(OVERLAY_STYLE_KEY, preset)
}