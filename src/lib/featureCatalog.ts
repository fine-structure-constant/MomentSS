export const PLUGIN_IDS = ['rich-text', 'markdown', 'heic', 'photo-metadata', 'font-rounded', 'font-sans', 'emoji-twemoji', 'emoji-fluent'] as const
export type PluginId = typeof PLUGIN_IDS[number]
