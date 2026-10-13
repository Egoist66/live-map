/**
 * Табы свайпов ULove: имена, нормализация и пути.
 *
 * Чистый модуль без зависимостей (ни vue, ни api, ни сторах): его можно
 * импортировать из ядра (useLayoutRoute в персистентном лейауте) без риска
 * притянуть весь дейтинг-граф (`useSwipes` → dating.api/chat.api → ~1МБ
 * в entry-замыкание первого визита, ловит check-bundle-isolation.mjs).
 *
 * @example
 * ```ts
 * import { normalizeSwipeTab } from '@/utils/swipe-tabs'
 * normalizeSwipeTab('tape') // 'feed'
 * ```
 */

/** Табы свайпов с отдельными роутами. */
export const SWIPE_TABS = ['feed', 'active', 'favorites', 'admirers', 'questionnaire', 'premium'] as const

/** Таб свайпов. */
export type SwipeTab = (typeof SWIPE_TABS)[number]

/**
 * Привести сырое значение к табу свайпов.
 *
 * Алиас tape ведёт на ленту.
 *
 * @param raw значение из роута или query
 * @returns таб свайпов, по умолчанию лента
 */
export function normalizeSwipeTab(raw: unknown): SwipeTab {
  const tab = String(raw ?? '')
  if (tab === 'tape') return 'feed'
  return (SWIPE_TABS as readonly string[]).includes(tab) ? (tab as SwipeTab) : 'feed'
}

/**
 * Путь таба свайпов для навигации с историей назад.
 *
 * @param tab таб свайпов
 * @returns путь вида /swipes/active
 */
export function swipeTabPath(tab: SwipeTab): string {
  return tab === 'feed' ? '/swipes/tape' : `/swipes/${tab}`
}
