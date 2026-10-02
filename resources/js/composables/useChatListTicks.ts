import { resolveMessageStatus } from '@/composables/useChatMessageStatus'

/**
 * Тики последнего сообщения для строк списка чатов.
 *
 * Показывает ✓ / ✓✓ / синие ✓✓ только для своих последних сообщений:
 * чужое сообщение тиков не имеет (там бейдж непрочитанного).
 * Поле `last_message` уже несёт `sender_id`, `read_at`, `delivered_at`,
 * `status` из `Message::toArrayPayload`, отдельных запросов не нужно.
 *
 * @param getCurrentUserId геттер id текущего пользователя
 * @returns предикат своих сообщений и резолвер статуса
 * @example
 * const ticks = useChatListTicks(() => currentUserId)
 * ticks.lastMessageStatus(conv) // 'read' | 'delivered' | 'sent' | null
 */
export function useChatListTicks(getCurrentUserId: () => number) {
  /**
   * Последнее сообщение диалога отправлено мной.
   *
   * @param conversation строка диалога из списка
   * @returns true — последнее писал я и тик уместен
   */
  function isOwnLast(conversation: any): boolean {
    const last = conversation?.last_message
    const senderId = Number(last?.sender_id ?? 0)
    const me = Number(getCurrentUserId() ?? 0)

    if (!last || !senderId || !me) {
      return false
    }

    return senderId === me
  }

  /**
   * Статус своего последнего сообщения для `MessageTicks`.
   *
   * @param conversation строка диалога из списка
   * @returns статус тика или null для чужих/пустых диалогов
   */
  function lastMessageStatus(conversation: any): string | null {
    if (!isOwnLast(conversation)) {
      return null
    }

    return resolveMessageStatus(conversation?.last_message, true)
  }

  return { isOwnLast, lastMessageStatus }
}
