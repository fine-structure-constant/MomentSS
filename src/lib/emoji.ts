import type { Locale } from '../i18n/types'

export const EMOJI_CATEGORIES = ['faces', 'nature', 'food', 'travel', 'symbols'] as const
export type EmojiCategory = typeof EMOJI_CATEGORIES[number]
export interface EmojiEntry { value: string; category: EmojiCategory; names: Record<Locale, string> }

// A compact offline palette; pasted and system-keyboard emoji remain unrestricted.
const groups: Record<EmojiCategory, Array<[string, string, string, string]>> = {
  faces: [
    ['😀', '开心 笑脸', '開心 笑臉', 'happy smile'], ['😄', '大笑 高兴', '大笑 高興', 'laugh joy'],
    ['😊', '微笑 害羞', '微笑 害羞', 'smile blush'], ['🥰', '喜欢 爱心', '喜歡 愛心', 'love hearts'],
    ['😍', '心动 喜爱', '心動 喜愛', 'heart eyes love'], ['😘', '亲吻', '親吻', 'kiss'],
    ['😎', '墨镜 酷', '墨鏡 酷', 'cool sunglasses'], ['🤩', '惊喜 星星眼', '驚喜 星星眼', 'star eyes excited'],
    ['🥳', '庆祝 派对', '慶祝 派對', 'party celebrate'], ['😂', '笑哭', '笑哭', 'laugh tears'],
    ['🥹', '感动 泪眼', '感動 淚眼', 'moved happy tears'], ['😭', '哭泣', '哭泣', 'cry tears'],
    ['🤔', '思考', '思考', 'think'], ['😴', '睡觉', '睡覺', 'sleep'],
    ['👍', '赞 棒', '讚 棒', 'thumbs up good'], ['👍🏽', '赞 中等肤色', '讚 中等膚色', 'thumbs up medium skin'],
    ['👏', '鼓掌', '鼓掌', 'clap applause'], ['🙌', '举手 欢呼', '舉手 歡呼', 'hands cheer'],
    ['🙏', '感谢 合十', '感謝 合十', 'thanks pray'], ['👋', '挥手 再见', '揮手 再見', 'wave hello goodbye'],
    ['🫶', '比心 爱', '比心 愛', 'heart hands love'], ['👨‍👩‍👧‍👦', '家庭 家人', '家庭 家人', 'family'],
  ],
  nature: [
    ['🌸', '樱花 花', '櫻花 花', 'cherry blossom flower'], ['🌻', '向日葵', '向日葵', 'sunflower'],
    ['🌿', '绿叶 植物', '綠葉 植物', 'herb plant leaf'], ['🍃', '叶子 风', '葉子 風', 'leaf wind'],
    ['🍁', '枫叶 秋天', '楓葉 秋天', 'maple autumn'], ['🌊', '海浪 海边', '海浪 海邊', 'wave sea beach'],
    ['☀️', '太阳 晴天', '太陽 晴天', 'sun sunny'], ['🌙', '月亮 夜晚', '月亮 夜晚', 'moon night'],
    ['⭐', '星星', '星星', 'star'], ['🌈', '彩虹', '彩虹', 'rainbow'],
    ['❄️', '雪花 冬天', '雪花 冬天', 'snow winter'], ['🔥', '火 热情', '火 熱情', 'fire hot'],
    ['🐱', '猫', '貓', 'cat'], ['🐶', '狗', '狗', 'dog'], ['🦋', '蝴蝶', '蝴蝶', 'butterfly'],
  ],
  food: [
    ['☕', '咖啡', '咖啡', 'coffee'], ['🍵', '茶', '茶', 'tea'], ['🧋', '奶茶', '奶茶', 'bubble tea'],
    ['🍰', '蛋糕 甜点', '蛋糕 甜點', 'cake dessert'], ['🍦', '冰淇淋', '冰淇淋', 'ice cream'],
    ['🍓', '草莓', '草莓', 'strawberry'], ['🍉', '西瓜', '西瓜', 'watermelon'],
    ['🍋', '柠檬', '檸檬', 'lemon'], ['🥐', '可颂 面包', '可頌 麵包', 'croissant bread'],
    ['🍜', '面条 拉面', '麵條 拉麵', 'noodles ramen'], ['🍣', '寿司', '壽司', 'sushi'],
    ['🍕', '披萨', '披薩', 'pizza'], ['🍻', '啤酒 干杯', '啤酒 乾杯', 'beer cheers'],
  ],
  travel: [
    ['✈️', '飞机 旅行', '飛機 旅行', 'airplane travel'], ['🚆', '火车', '火車', 'train'],
    ['🚗', '汽车 自驾', '汽車 自駕', 'car road trip'], ['🚲', '自行车 骑行', '自行車 騎行', 'bicycle cycling'],
    ['⛵', '帆船', '帆船', 'sailboat'], ['🏖️', '沙滩 海边', '沙灘 海邊', 'beach'],
    ['🏕️', '露营 帐篷', '露營 帳篷', 'camping tent'], ['⛰️', '山 登山', '山 登山', 'mountain hiking'],
    ['🏔️', '雪山', '雪山', 'snow mountain'], ['🌅', '日出', '日出', 'sunrise'],
    ['🌇', '日落 城市', '日落 城市', 'sunset city'], ['🌃', '夜景', '夜景', 'night city'],
    ['📍', '位置 地点', '位置 地點', 'pin location'], ['📷', '相机 摄影', '相機 攝影', 'camera photo'],
    ['🧳', '行李 旅行', '行李 旅行', 'luggage travel'], ['🗺️', '地图', '地圖', 'map'],
    ['🇨🇳', '中国 国旗', '中國 國旗', 'China flag'], ['🇯🇵', '日本 国旗', '日本 國旗', 'Japan flag'],
  ],
  symbols: [
    ['❤️', '红心 爱', '紅心 愛', 'red heart love'], ['🧡', '橙心', '橙心', 'orange heart'],
    ['💛', '黄心', '黃心', 'yellow heart'], ['💚', '绿心', '綠心', 'green heart'],
    ['💙', '蓝心', '藍心', 'blue heart'], ['💜', '紫心', '紫心', 'purple heart'],
    ['🤍', '白心', '白心', 'white heart'], ['🖤', '黑心', '黑心', 'black heart'],
    ['✨', '闪光 星星', '閃光 星星', 'sparkles star'], ['🎉', '庆祝 礼花', '慶祝 禮花', 'party confetti celebrate'],
    ['🎈', '气球', '氣球', 'balloon'], ['🎁', '礼物', '禮物', 'gift'],
    ['🎵', '音乐 音符', '音樂 音符', 'music note'], ['✅', '完成 勾', '完成 勾', 'check done'],
    ['💯', '满分', '滿分', 'hundred perfect'], ['♾️', '无限', '無限', 'infinity'],
  ],
}

export const EMOJI_ENTRIES: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((category) => groups[category].map(([value, zhCN, zhTW, en]) => ({
  value, category, names: { 'zh-CN': zhCN, 'zh-TW': zhTW, en },
})))

export function searchEmoji(query: string, category: EmojiCategory): EmojiEntry[] {
  const normalized = query.trim().toLocaleLowerCase()
  return EMOJI_ENTRIES.filter((entry) => normalized
    ? [entry.value, ...Object.values(entry.names)].some((name) => name.toLocaleLowerCase().includes(normalized))
    : entry.category === category)
}

const RECENT_KEY = 'liubai-recent-emoji'
export function readRecentEmoji(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(stored) ? [...new Set(stored.filter((value) => typeof value === 'string' && EMOJI_ENTRIES.some((entry) => entry.value === value)))].slice(0, 7) : []
  } catch { return [] }
}

export function rememberEmoji(value: string): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([value, ...readRecentEmoji().filter((item) => item !== value)].slice(0, 7))) } catch { /* Insertion also works without browser storage. */ }
}
