import { computed, ref } from 'vue'
import { usePinActivity } from '@/composables/usePinActivity'
import { useAppUpdates } from '@/composables/useAppUpdates'
import { useSecurityImpersonations } from '@/composables/useSecurityImpersonations'
import { useBellNotifications } from '@/composables/useBellNotifications'
import { useBadgeStore } from '@/stores/badges'
import { chatApi } from '@/services/chat.api'

/**
 * Кнопка «прочитать всё» в модалке уведомлений.
 *
 * Одним нажатием гасит все непрочитанные источники: ленту событий/пинов
 * (лайки, комменты, упоминания), сообщения диалогов, новости приложения
 * и предупреждения безопасности. Заявки в друзья и жалобы не трогает —
 * они требуют действия (принять/разобрать), а не просмотра.
 * Бейджи обновляются оптимистично внутри каждого хука,
 * реалтайм-бас подтянет остальное сам.
 *
 * @returns флаг загрузки, наличие непрочитанного и действие чтения
 * @example
 * const readAllState = useNotificationsReadAll()
 * // <Button @click="readAllState.readAll()" :loading="readAllState.reading.value" />
 */
export function useNotificationsReadAll() {
  const pinAct = usePinActivity()
  const updates = useAppUpdates()
  const proc = useSecurityImpersonations()
  const bell = useBellNotifications()
  const reading = ref(false)

  const hasUnread = computed(() => {
    const inboxUnread = Number(pinAct.unread.value ?? 0)
    const newsUnread = Number(updates.unreadCount.value ?? 0)
    const procUnread = Number(proc.unread.value ?? 0)
    const chatUnread = Number(bell.unreadCount.value ?? 0)
    return inboxUnread > 0 || newsUnread > 0 || procUnread > 0 || chatUnread > 0
  })

  /**
   * Совместимость: раньше колокольчик гасился сам при открытии.
   * Больше не помечаем ничего автоматически — иначе строка пропадает
   * из непрочитанных раньше, чем пользователь её увидел.
   * Оставлено как no-op для старых вызовов.
   *
   * @returns void
   */
  async function markBellOpened(): Promise<void> {
    return
  }

  /**
   * Помечает всё прочитанным параллельно, ошибки одного источника
   * не отменяют остальные.
   *
   * @returns void
   */
  async function readAll(): Promise<void> {
    if (reading.value || !hasUnread.value) {
      return
    }
    reading.value = true
    try {
      const jobs: Array<Promise<unknown>> = []
      if (Number(pinAct.unread.value ?? 0) > 0) {
        jobs.push(pinAct.markAllRead())
      }
      if (Number(updates.unreadCount.value ?? 0) > 0) {
        jobs.push(updates.dismissAll())
      }
      if (Number(proc.unread.value ?? 0) > 0) {
        jobs.push(proc.markRead())
      }
      if (Number(bell.unreadCount.value ?? 0) > 0) {
        jobs.push(markAllChatsRead())
      }
      await Promise.allSettled(jobs)
    } finally {
      reading.value = false
    }
  }

  /**
   * Помечает прочитанными все диалоги с непрочитанными сообщениями.
   *
   * Идёт по свежему списку колокольчика, шлёт markRead параллельно
   * и оптимистично гасит счётчики. Если локальный топ пуст, а счётчик
   * висит — сначала тянет свежий список (непрочитанные могли быть
   * за пределами топ-8), иначе гасит залипший бейдж напрямую.
   *
   * @returns void
   */
  async function markAllChatsRead(): Promise<void> {
    const unreadConvs = bell.conversations.value.filter((c: any) => Number(c?.unread_count ?? 0) > 0)
    if (unreadConvs.length === 0) {
      try {
        await bell.fetchAll()
      } catch {
        return
      }
      const retry = bell.conversations.value.filter((c: any) => Number(c?.unread_count ?? 0) > 0)
      if (retry.length === 0) {
        try {
          useBadgeStore().setUnread(0)
        } catch {
          // No-op: следующий тик поллера сам выровняет бейдж.
        }
        return
      }
      await markConvsRead(retry)
      return
    }
    await markConvsRead(unreadConvs)
  }

  /**
   * Шлёт markRead по диалогам и гасит локальные счётчики.
   *
   * @param convs диалоги с `unread_count > 0`
   * @returns void
   */
  async function markConvsRead(convs: any[]): Promise<void> {
    const ids = convs.map((c: any) => Number(c?.id ?? 0)).filter((id: number) => id > 0)
    await Promise.allSettled(ids.map((id: number) => chatApi.markRead(id)))
    for (const conv of convs) {
      conv.unread_count = 0
    }
    try {
      const badge = useBadgeStore()
      badge.setUnread(0)
      badge.setUnreadMessages(0)
    } catch {
      // No-op: следующий тик поллера сам выровняет бейдж.
    }
    try {
      await bell.fetchAll()
    } catch {
      // No-op: список уже погашен оптимистично выше.
    }
  }

  return { reading, hasUnread, readAll, markBellOpened }
}
