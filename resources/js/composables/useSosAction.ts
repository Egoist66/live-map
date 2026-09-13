import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { fetchPinSos, type SosCallState } from '@/services/sos.api'
import { useSosStore } from '@/stores/sos'

/**
 * Действия с SOS-пином для зрителя: статус, принять, отклонить.
 *
 * @param pinId id SOS-пина
 * @returns состояние вызова и действия
 * @example
 * const action = useSosAction(pin.id)
 * await action.load()
 */
export function useSosAction(pinId: number) {
  const store = useSosStore()
  const call = ref<SosCallState | null>(null)
  const declined = ref(false)
  const isCreator = ref(false)
  const loading = ref(false)

  const canAccept = computed(() => !!call.value && call.value.status === 'pending' && !isCreator.value && !declined.value)
  const acceptedByOther = computed(() => !!call.value?.responder && Number(call.value.responder.id) !== 0 && call.value.status === 'active')

  /**
   * Загрузить состояние SOS пина.
   */
  async function load(): Promise<void> {
    loading.value = true
    try {
      const data = await fetchPinSos(pinId)
      call.value = data.sos
      declined.value = data.declined_by_me
      isCreator.value = data.is_creator
    } catch {
      call.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Принять SOS и получить id чата.
   * @returns conversation_id
   */
  async function accept(): Promise<number | null> {
    const conversationId = await store.accept(pinId)
    await load()
    return conversationId
  }

  /**
   * Отклонить SOS.
   */
  async function reject(): Promise<void> {
    await store.decline(pinId)
    declined.value = true
  }

  /**
   * Принять SOS и сразу перейти в отдельный чат.
   * @returns conversation_id или null
   */
  async function acceptAndChat(): Promise<number | null> {
    const conversationId = await accept()
    if (conversationId) {
      try {
        router.visit(`/chat/${conversationId}`)
      } catch {}
    }
    return conversationId
  }

  return { call, declined, isCreator, loading, canAccept, acceptedByOther, acting: computed(() => store.acting), error: computed(() => store.error), load, accept, acceptAndChat, reject }
}
