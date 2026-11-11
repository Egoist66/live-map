import { onBeforeUnmount, onMounted } from 'vue'
import { useRealtimeMode } from '@/composables/useRealtimeMode'
import { useRealtimePoller } from '@/composables/useRealtimePoller'

/**
 * Realtime-фон мини-сайта Pipe (pipe.ulove.by).
 *
 * Выбирает транспорт (socket|polling) один раз на монтировании лейаута:
 * - socket: Echo-каналы (threads.pipe.{id} и user.{id}) работают сами;
 * - polling: тикает поллер, который добирает thread_tickets
 *   (watchThreads) и inbox-уведомления.
 *
 * Тосты/шина уведомлений подключает GlobalNotificationToasts — он
 * вызывает useAppNotifications (ensureUserChannel + подписки шины).
 *
 * @example
 * // <script setup> PipeLayout.vue
 * usePipeRealtime()
 */
export function usePipeRealtime(): void {
  const realtimeMode = useRealtimeMode()
  const realtimePoller = useRealtimePoller()

  onMounted(() => {
    void initTransport()
  })

  onBeforeUnmount(() => {
    realtimePoller.stop()
  })

  /**
   * Режим транспорта пришёл с сервера (api/realtime/mode): сокет — по
   * умолчанию; polling — запасной. Оба транспорта в итоге публикуют
   * события в одну realtime-шину, подписчикам безразлично.
   */
  async function initTransport(): Promise<void> {
    try {
      const current = await realtimeMode.init()
      realtimePoller.ensure(current)
    } catch {
      realtimePoller.ensure('socket')
    }
  }
}
