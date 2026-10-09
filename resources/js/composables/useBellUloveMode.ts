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
 * В uloveOnly модалка прячет только модульные разделы (пины, UFlow,
 * районы): их строки бэк не создаёт и не считает при выключенных
 * модулях. Базовый слой (ULove, фото, подписки, прочие события,
 * заявки в друзья, жалобы, сообщения, безопасность, новости)
 * показывается всегда — иначе бейдж топбара и модалка расходятся
 * («висит 1, а внутри пусто»).
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
 * ULove-бейдж шапки модалки: базовый слой без пинов/UFlow/районов.
 *
 * Модульные разделы (пины, UFlow, районы) бэк не создаёт и не считает
 * при выключенных модулях, а базовый слой (ULove, фото, подписки,
 * прочие события, заявки, жалобы, сообщения, безопасность, новости)
 * виден всегда — иначе в топбаре висит «1», а в модалке пусто.
 */
export function uloveHeaderBadge(parts: {
  loveUnread: number
  chatUnread: number
  securityUnread: number
  newsUnread: number
  appUnread?: number
  photoUnread?: number
  subUnread?: number
  genericUnread?: number
  otherUnread?: number
  pending?: number
  reportsUnread?: number
}): number {
  const total =
    parts.loveUnread +
    parts.chatUnread +
    parts.securityUnread +
    parts.newsUnread +
    (parts.appUnread ?? 0) +
    (parts.photoUnread ?? 0) +
    (parts.subUnread ?? 0) +
    (parts.genericUnread ?? 0) +
    (parts.otherUnread ?? 0) +
    (parts.pending ?? 0) +
    (parts.reportsUnread ?? 0)

  return total > 0 ? total : 0
}
