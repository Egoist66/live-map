import { computed, watch, type Ref } from 'vue'
import { useTelegram } from '@/composables/useTelegram'
import { useTelegramShare } from '@/composables/useTelegramShare'

/**
 * Видимость и действия обмена Telegram-username в шапке чата.
 *
 * Панель «Поделиться Telegram» живёт только внутри Telegram Mini App
 * и только в личном (`direct`) диалоге, а сами кнопки спрятаны в `⋯`
 * меню `ChatWindow` — отдельной синей полосы над сообщениями больше нет.
 * Компонент только рисует пункты меню и дёргает `offer`/`revoke`.
 *
 * @example
 * ```ts
 * const telegramShareMenu = useChatTelegramShare(
 *   toRef(props, 'selectedId'),
 *   toRef(props, 'activeConv'),
 * )
 * await telegramShareMenu.offer()
 * ```
 *
 * @param conversationId id открытого диалога
 * @param conversation активный диалог (нужен `type === 'direct'`)
 * @returns флаг TG-окружения, доступность пункта меню и методы обмена
 */
export function useChatTelegramShare(
  conversationId: Ref<number | null>,
  conversation: Ref<unknown>,
) {
  const { isTelegram } = useTelegram()
  const share = useTelegramShare()

  const isDirect = computed(() => {
    const conv = conversation.value as { type?: unknown } | null
    return conv?.type === 'direct'
  })

  /**
   * Показывать ли пункт «Telegram» в `⋯` меню.
   *
   * Только Telegram-окружение + личный диалог: в обычном вебе
   * обмен username не нужен и меню не засоряет.
   */
  const canShare = computed(() => {
    const id = conversationId.value
    return isTelegram.value && isDirect.value && id != null
  })

  const waitingPeer = computed(() => share.waitingPeer.value)
  const exchanged = computed(() => share.exchanged.value)

  /**
   * Подпись пункта меню под текущее состояние обмена.
   */
  const menuLabel = computed(() => {
    if (share.exchanged.value) {
      return 'Telegram обменян'
    }
    if (share.mine.value) {
      return 'Отозвать Telegram'
    }
    return 'Поделиться Telegram'
  })

  /**
   * Короткий статус для второй строки пункта меню.
   */
  const menuHint = computed(() => {
    if (share.exchanged.value) {
      const username = share.peerUsername.value
      return username !== null && username !== '' ? `@${username}` : 'username обменян'
    }
    if (share.peer.value && !share.mine.value) {
      return 'собеседник уже поделился — нажмите'
    }
    if (share.waitingPeer.value) {
      return 'ждём собеседника'
    }
    return 'обмен по обоюдному согласию'
  })

  watch(
    conversation,
    (next) => share.applyConversation(next),
    { immediate: true },
  )

  /**
   * Поделиться своим username (пункт меню `⋯`).
   *
   * @returns true когда оффер принят сервером
   */
  async function offer(): Promise<boolean> {
    const id = Number(conversationId.value ?? 0)
    if (!(id > 0)) {
      return false
    }
    return share.offer(id)
  }

  /**
   * Отозвать своё намерение до момента обмена.
   *
   * @returns true когда оффер снят
   */
  async function revoke(): Promise<boolean> {
    const id = Number(conversationId.value ?? 0)
    if (!(id > 0)) {
      return false
    }
    return share.revoke(id)
  }

  /**
   * Один тоггл для пункта меню: поделиться или отозвать.
   *
   * @returns true когда запрос принят
   */
  async function toggleShare(): Promise<boolean> {
    if (share.mine.value) {
      return revoke()
    }
    return offer()
  }

  return {
    isTelegram,
    isDirect,
    canShare,
    menuLabel,
    menuHint,
    waitingPeer,
    exchanged,
    share,
    offer,
    revoke,
    toggleShare,
  }
}
