import { computed, ref } from 'vue'
import { videoApi } from '@/services/video.api'
import { busOn } from '@/services/realtime-bus'

/**
 * Сообщение чата звонка.
 */
export interface VideoChatMessage {
  id: number
  mine: boolean
  text: string
}

/**
 * Текстовый чат внутри звонка: обмен контактами не прерывая разговор.
 *
 * Едет тем же транспортом, что сигналинг (REST + broadcast + polling),
 * видом фрейма kind=chat — отдельных таблиц и каналов не нужно.
 * История эфемерна: чистятся вместе с сигналами завершённого звонка.
 * Смена звонка сбрасывает ленту.
 *
 * @example
 * const chat = useVideoCallChat(() => store.call?.id ?? null)
 * await chat.send('мой тг: @nick')
 */
export function useVideoCallChat(callIdOf: () => number | null) {
  const messages = ref<VideoChatMessage[]>([])
  const sending = ref(false)
  const unread = ref(0)
  const seenIds = new Set<number>()

  busOn('user:video.signal', (e) => {
    if (String(e?.kind) !== 'chat') return
    const activeId = callIdOf()
    if (!activeId || Number(e.call_id) !== activeId) return
    const id = Number(e.id ?? 0)
    if (!id || seenIds.has(id)) return
    seenIds.add(id)
    const text = String(e.payload?.text ?? '').trim()
    if (!text) return
    messages.value = [...messages.value, { id, mine: false, text }].slice(-100)
    unread.value += 1
  })

  /** Есть ли сообщения. */
  const hasMessages = computed(() => messages.value.length > 0)

  /**
   * Отправить сообщение в звонок.
   * Своё дописываем локально: broadcast идёт только второму (toOthers).
   *
   * @param raw текст из поля ввода
   * @returns false когда пусто или некуда слать
   */
  async function send(raw: string): Promise<boolean> {
    const text = raw.trim().slice(0, 500)
    const callId = callIdOf()
    if (!text || !callId || sending.value) return false
    sending.value = true
    try {
      const res = await videoApi.signal(callId, 'chat', { text })
      const id = Number(res.id ?? 0)
      if (id) seenIds.add(id)
      messages.value = [...messages.value, { id, mine: true, text }].slice(-100)
      return true
    } catch {
      return false
    } finally {
      sending.value = false
    }
  }

  /**
   * Сбросить ленту (смена звонка, отбой).
   */
  function reset(): void {
    messages.value = []
    unread.value = 0
    seenIds.clear()
  }

  /**
   * Пометить прочитанным (открытие панели).
   */
  function markRead(): void {
    unread.value = 0
  }

  return { messages, sending, unread, hasMessages, send, reset, markRead }
}
