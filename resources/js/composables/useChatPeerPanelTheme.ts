import { computed, type Ref } from 'vue'

/**
 * Тема правой панели собеседника: дефолтный Tinder-стиль ULove
 * или стиль карты ULove.
 */
export type ChatPeerTone = 'ulove' | 'upin'

/**
 * Классы оформления панели и её тоггла под текущий набор модулей.
 */
export interface ChatPeerTheme {
  /** Кольцо аватара */
  ring: string
  /** Пилюля бейджа знакомства */
  badge: string
  /** Пилюля «Мэтч» */
  match: string
  /** Заголовок секции анкеты */
  sectionTitle: string
  /** Кнопка «Открыть профиль» */
  cta: string
  /** Подсветка кнопки-тоггла в шапке чата */
  toggleActive: string
}

const THEMES: Record<ChatPeerTone, ChatPeerTheme> = {
  ulove: {
    ring: 'bg-gradient-to-br from-[#FD267D] to-[#FF7854]',
    badge: 'bg-gradient-to-r from-[#FD267D] to-[#FF7854]',
    match: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
    sectionTitle: 'Анкета ULove',
    cta: '!bg-gradient-to-r !from-[#FD267D] !to-[#FF7854]',
    toggleActive: '!bg-rose-50 !text-rose-600 dark:!bg-rose-500/15 dark:!text-rose-300',
  },
  upin: {
    ring: 'bg-gradient-to-br from-sky-500 to-indigo-600',
    badge: 'bg-gradient-to-r from-sky-500 to-indigo-600',
    match: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    sectionTitle: 'О собеседнике',
    cta: '!bg-gradient-to-r !from-sky-500 !to-indigo-600',
    toggleActive: '!bg-sky-50 !text-sky-600 dark:!bg-sky-500/15 dark:!text-sky-300',
  },
}

/**
 * Тема панели собеседника: ULove по умолчанию, карта-бонус — когда в приложении
 * включены другие разделы. Как только остаётся только ULove — возвращается
 * дефолтный Tinder-стиль (значение реактивно, переключается само).
 *
 * @param tone 'ulove' | 'upin' или ref на него
 * @returns токены классов оформления
 * @example
 * ```ts
 * const theme = useChatPeerPanelTheme(() => (uloveOnly.value ? 'ulove' : 'upin'))
 * ```
 */
export function useChatPeerPanelTheme(tone: ChatPeerTone | Ref<ChatPeerTone> | (() => ChatPeerTone)) {
  const theme = computed<ChatPeerTheme>(() => {
    let current: ChatPeerTone

    if (typeof tone === 'function') {
      current = (tone as () => ChatPeerTone)()
    } else if (typeof tone === 'string') {
      current = tone
    } else {
      current = tone.value
    }

    return THEMES[current] ?? THEMES.ulove
  })

  return theme
}
