import { ref, computed } from 'vue'

/**
 * Ответ на конкретное сообщение: выбор цитаты, превью, отмена.
 * @returns состояние ответа и действия
 */
export function useMessageReply() {
  const replyTo = ref<any | null>(null)

  /**
   * Начать ответ на сообщение.
   * @param m цитируемое сообщение
   */
  function startReply(m: any): void {
    if ((m as any)?.pending) return
    replyTo.value = m
  }

  function cancelReply(): void {
    replyTo.value = null
  }

  const replySnippet = computed(() => {
    const t = String(replyTo.value?.body ?? '').replace(/\s+/g, ' ').trim()
    return t.length > 80 ? `${t.slice(0, 80)}…` : t
  })

  const replySenderName = computed(() => String(replyTo.value?.sender?.name ?? replyTo.value?.reply_to?.sender_name ?? ''))

  return { replyTo, replySnippet, replySenderName, startReply, cancelReply }
}
