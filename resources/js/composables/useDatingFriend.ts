import { computed, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'

/**
 * Дружба с одним человеком: статус, заявка, принятие.
 *
 * Использует существующие ручки дружбы (те же, что табы чата):
 * добавить, принять входящую, состояние исходящей. Компонент
 * только отображает кнопку и зовёт методы.
 *
 * @param targetId id человека
 * @returns состояние дружбы и действия
 * @example const f = useDatingFriend(() => card.id); await f.refresh()
 */
export function useDatingFriend(targetId: () => number | null) {
  const friendship = ref<{ id: number; requester_id: number; addressee_id: number; status: string } | null>(null)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  /**
   * Свой id из auth-пропсов: отличаем исходящую заявку от входящей.
   */
  const myId = (() => {
    try {
      const authUser = (usePage().props as unknown as { auth?: { user?: { id?: number } } }).auth?.user ?? null
      const id = Number(authUser?.id ?? 0)
      return id > 0 ? id : null
    } catch {
      return null
    }
  })()

  const isFriend = computed(() => friendship.value?.status === 'accepted')
  const isPending = computed(() => friendship.value?.status === 'pending')
  const isOutgoing = computed(
    () => isPending.value && myId != null && friendship.value?.requester_id === myId,
  )

  /**
   * Обновить статус дружбы с человеком.
   */
  async function refresh(): Promise<void> {
    const id = targetId()

    if (!id) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = await chatApi.status(id)
      friendship.value = data?.friendship ?? null
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }

      if (err.response?.status !== 404) {
        error.value = 'Не получилось проверить дружбу'
      }

      friendship.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Отправить заявку в друзья.
   */
  async function add(): Promise<void> {
    const id = targetId()

    if (!id || busy.value || isFriend.value || isPending.value) {
      return
    }

    busy.value = true
    error.value = null

    try {
      await chatApi.addFriend(id)
      await refresh()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не получилось отправить заявку'
      throw e
    } finally {
      busy.value = false
    }
  }

  /**
   * Принять входящую заявку.
   */
  async function acceptIncoming(): Promise<void> {
    const row = friendship.value

    if (!row || busy.value || row.status !== 'pending' || isOutgoing.value) {
      return
    }

    busy.value = true
    error.value = null

    try {
      await chatApi.accept(row.id)
      await refresh()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не получилось принять заявку'
      throw e
    } finally {
      busy.value = false
    }
  }

  watch(
    targetId,
    (id) => {
      friendship.value = null

      if (id) {
        void refresh()
      }
    },
    { immediate: true },
  )

  return { friendship, isFriend, isPending, isOutgoing, loading, busy, error, refresh, add, acceptIncoming }
}
