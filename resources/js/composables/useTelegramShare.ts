import { computed, ref } from 'vue'
import { api } from '@/services/api'

export interface TelegramShareState {
  mine: boolean
  peer: boolean
  exchanged: boolean
  peerUsername: string | null
}

/**
 * Обмен Telegram-username по обоюдному согласию в личном диалоге.
 *
 * Вся логика здесь (Правило №1): компонент только рисует панель
 * и дёргает offer/revoke. Начальное состояние берём из
 * `activeConv.telegram_share` (ConversationController::show),
 * дальше сервер возвращает свежий статус каждым ответом.
 *
 * Юзернейм собеседника виден только после взаимного обмена —
 * до этого бэк отдаёт null, и панель его не показывает.
 *
 * @example
 * ```ts
 * const share = useTelegramShare()
 * share.applyConversation(activeConv)
 * await share.offer(conversationId)
 * ```
 *
 * @returns состояние обмена и методы
 */
export function useTelegramShare() {
  const mine = ref(false)
  const peer = ref(false)
  const exchanged = ref(false)
  const peerUsername = ref<string | null>(null)
  const loading = ref(false)
  const errorCode = ref<string | null>(null)

  const peerLink = computed(() => (peerUsername.value ? `https://t.me/${peerUsername.value}` : null))
  const waitingPeer = computed(() => mine.value && !peer.value && !exchanged.value)

  /**
   * Применить статус из JSON (ответ show/offer/revoke).
   *
   * @param data сырой `telegram_share` из API
   */
  function applyState(data: unknown): void {
    const raw = (data ?? {}) as Partial<Record<'mine' | 'peer' | 'exchanged' | 'peer_username' | 'error', unknown>>
    mine.value = raw.mine === true
    peer.value = raw.peer === true
    exchanged.value = raw.exchanged === true
    const username = typeof raw.peer_username === 'string' ? raw.peer_username.trim() : ''
    peerUsername.value = exchanged.value && username !== '' ? username : null
    errorCode.value = typeof raw.error === 'string' && raw.error !== '' ? raw.error : null
  }

  /**
   * Подтянуть статус из уже загруженного диалога (без запроса).
   *
   * @param conversation activeConv из show API
   */
  function applyConversation(conversation: unknown): void {
    const share = (conversation as { telegram_share?: unknown } | null)?.telegram_share ?? null
    if (share) {
      applyState(share)
    } else {
      mine.value = false
      peer.value = false
      exchanged.value = false
      peerUsername.value = null
      errorCode.value = null
    }
  }

  /**
   * Поделиться своим username (создать оффер).
   *
   * Второй оффер пары триггерит обмен: обоим в личку бота падает
   * @username собеседника. Без username у кого-то — error no_username.
   *
   * @param conversationId id direct-диалога
   * @returns true когда запрос принят (обмен мог состояться)
   */
  async function offer(conversationId: number): Promise<boolean> {
    if (!conversationId || loading.value) {
      return false
    }
    loading.value = true
    errorCode.value = null
    try {
      const response = await api.post(`/api/conversations/${conversationId}/telegram-share`)
      applyState(response.data ?? {})
      return true
    } catch (requestError: unknown) {
      errorCode.value = readErrorCode(requestError)
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Отозвать своё намерение (до момента обмена).
   *
   * @param conversationId id direct-диалога
   * @returns true когда оффер снят
   */
  async function revoke(conversationId: number): Promise<boolean> {
    if (!conversationId || loading.value) {
      return false
    }
    loading.value = true
    errorCode.value = null
    try {
      const response = await api.delete(`/api/conversations/${conversationId}/telegram-share`)
      applyState(response.data ?? {})
      return true
    } catch (requestError: unknown) {
      errorCode.value = readErrorCode(requestError)
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Достать код ошибки из ответа API.
   *
   * @param requestError ошибка axios
   * @returns no_username | текст ошибки | request_failed
   */
  function readErrorCode(requestError: unknown): string {
    try {
      const response = (requestError as { response?: { data?: { error?: unknown; message?: unknown } } }).response
      const error = response?.data?.error
      if (typeof error === 'string' && error !== '') {
        return error
      }
      const message = response?.data?.message
      if (typeof message === 'string' && message !== '') {
        return message
      }
    } catch {
      // фолбэк ниже
    }
    return 'request_failed'
  }

  return { mine, peer, exchanged, peerUsername, peerLink, waitingPeer, loading, errorCode, applyState, applyConversation, offer, revoke }
}
