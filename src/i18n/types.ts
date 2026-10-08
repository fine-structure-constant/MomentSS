import type { zhCN } from './locales/zh-CN'

export type Locale = 'zh-CN' | 'zh-TW' | 'en'
export type MessageKey = keyof typeof zhCN
export type MessageValues = Record<string, string | number>
