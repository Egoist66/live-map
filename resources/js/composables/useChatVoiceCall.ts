import { computed, type Ref } from 'vue'
import { useVideoSession } from '@/composables/useVideoSession'

/**
 * Голосовой звонок из шапки чата в один тап.
 *
 * Допуск проверяет бэк (мэтч, дружба или общий диалог + без блоков):
 * кнопка видна во всех личных диалогах.
 *
 * @param activeConv активный диалог (ref из useChat)
 * @returns флаг кнопки и действие звонка
 *
 * @example
 * const chatVoice = useChatVoiceCall(chat.activeConv)
 * <Button v-if="chatVoice.canCall.value" @click="chatVoice.callPeer()" />
 */
export function useChatVoiceCall(activeConv: Ref<any>) {
  const video = useVideoSession()

  /** Id собеседника личного диалога (у районных/групп — null). */
  const peerId = computed(() => {
    const conv = activeConv.value
    if (!conv || conv.title) return null
    const id = Number(conv.other?.id ?? 0)
    return id > 0 ? id : null
  })

  /** Показывать ли кнопку звонка: личный диалог + не в звонке. */
  const canCall = computed(() => peerId.value !== null && !video.store.inCall)

  /**
   * Позвонить собеседнику голосом: микрофон → звонок → оверлей откроется сам.
   * Ошибка допуска (посторонний) показывается оверлеем с текстом.
   */
  async function callPeer(): Promise<void> {
    const id = peerId.value
    if (id === null) return
    await video.callMatch(id)
  }

  return { peerId, canCall, callPeer }
}
