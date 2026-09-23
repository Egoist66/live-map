import type { InboxNotification } from '@/services/notifications.api'
import { useUloveOnly } from '@/composables/useUloveOnly'

/**
 * Проверяет, что строка inbox — уведомление самого приложения (от разработчиков).
 *
 * @param row строка inbox
 * @returns true для типов app.*
 */
export function isAppNotification(row: InboxNotification): boolean {
  return String(row?.type ?? '').startsWith('app.')
}

/**
 * Режим колокольчика для чистого ULove (только ulove без upin/uflow).
 *
 * В uloveOnly модалка показывает только уведомления самого приложения,
 * новости от разработчиков и ULove (мэтчи/лайки). Никаких пинов, UFlow,
 * фото, подписок, друзей/заявок и районов.
 *
 * Realtime-шина не трогается — фильтрация только отображения,
 * сокеты и поллер продолжают привозить всё как раньше.
 *
 * @returns флаг uloveOnly и фильтр app-уведомлений
 * @example const bellMode = useBellUloveMode()
 */
export function useBellUloveMode() {
  const uloveOnly = useUloveOnly()

  /**
   * Оставляет только уведомления самого приложения (app.*).
   *
   * @param rows строки секции «Уведомления»
   * @returns только app-строки
   */
  function onlyApp(rows: InboxNotification[]): InboxNotification[] {
    const appRows: InboxNotification[] = []

    for (const row of rows) {
      if (isAppNotification(row)) {
        appRows.push(row)
      }
    }

    return appRows
  }

  return { uloveOnly, isAppNotification, onlyApp }
}

/**
 * Непрочитанные среди app-уведомлений.
 *
 * @param rows уже отфильтрованные app-строки
 * @returns число непрочитанных
 */
export function countAppUnread(rows: InboxNotification[]): number {
  let unread = 0

  for (const row of rows) {
    if (!row.read_at) {
      unread += 1
    }
  }

  return unread
}

/**
 * ULove-бейдж шапки модалки: мэтчи/лайки + сообщения + безопасность + app + новости.
 *
 * Без пинов, UFlow, фото, подписок, заявок и районов.
 */
export function uloveHeaderBadge(parts: {
  loveUnread: number
  chatUnread: number
  securityUnread: number
  appUnread: number
  newsUnread: number
}): number {
  const total =
    parts.loveUnread +
    parts.chatUnread +
    parts.securityUnread +
    parts.appUnread +
    parts.newsUnread

  return total > 0 ? total : 0
}
