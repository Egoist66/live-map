import { watch } from 'vue'
import type { Ref } from 'vue'
import { useBadgeStore } from '@/stores/badges'

/**
 * Синхронизирует второстепенные счётчики страницы чатов с глобальным store.
 *
 * Непрочитанные диалоги намеренно не пишем из локального списка:
 * IndexedDB может отдать устаревший `unread_count`, и тогда «фантомная 1»
 * перетирает серверный ноль из `/api/realtime/badges`. Источник правды для
 * `badge.unread` — только сервер; локальное прочтение гасит его точечно
 * через `decUnread()` в `useChat`.
 *
 * @param pendingIn входящие заявки в друзья
 * @param unreadMessagesTotal локальное число непрочитанных сообщений
 * @returns глобальный store бейджей
 */
export function useChatBadges(pendingIn: Ref<any[]>, unreadMessagesTotal?: Ref<number>) {
  const badge = useBadgeStore()
  if (unreadMessagesTotal) watch(unreadMessagesTotal, (v) => badge.setUnreadMessages(v), { immediate: true })
  watch(() => pendingIn.value.length, (v) => badge.setPending(v), { immediate: true })
  return badge
}
