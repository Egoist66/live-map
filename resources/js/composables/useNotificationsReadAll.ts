import { computed, ref } from 'vue'
import { usePinActivity } from '@/composables/usePinActivity'
import { useAppUpdates } from '@/composables/useAppUpdates'
import { useSecurityImpersonations } from '@/composables/useSecurityImpersonations'

/**
 * Кнопка «прочитать всё» в модалке уведомлений.
 *
 * Одним нажатием гасит все непрочитанные источники: ленту событий/пинов,
 * новости приложения и предупреждения безопасности. Чаты и заявки не трогает —
 * их прочтение требует открытия диалога. Бейджи обновляются оптимистично
 * внутри каждого хука, реалтайм-бас подтянет остальное сам.
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
  const reading = ref(false)

  const hasUnread = computed(() => {
    const inboxUnread = Number(pinAct.unread.value ?? 0)
    const newsUnread = Number(updates.unreadCount.value ?? 0)
    const procUnread = Number(proc.unread.value ?? 0)
    return inboxUnread > 0 || newsUnread > 0 || procUnread > 0
  })

  /**
   * Гасит колокольчик при открытии: inbox (пины/события), новости и безопасность.
   *
   * Чаты и заявки не трогает — их прочтение требует открытия диалога,
   * поэтому счётчик сообщений остаётся. Вызывать после refresh() ленты,
   * чтобы hasUnread уже знал свежие счётчики с сервера.
   *
   * @returns void
   * @example
   * await readAllState.markBellOpened()
   */
  async function markBellOpened(): Promise<void> {
    await readAll()
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
      await Promise.allSettled(jobs)
    } finally {
      reading.value = false
    }
  }

  return { reading, hasUnread, readAll, markBellOpened }
}
