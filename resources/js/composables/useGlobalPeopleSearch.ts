import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { storeToRefs } from 'pinia'
import { chatApi } from '@/services/chat.api'
import { usePeopleSearchStore } from '@/stores/peopleSearch'
import { usePresenceState, isRecentlySeen } from '@/composables/usePresence'

/**
 * Глобальный поиск людей по Ctrl+K.
 *
 * Тонкий хук над `usePeopleSearchStore`: открывает диалог,
 * считает онлайн, создаёт чат / заявку / блок.
 *
 * @example
 * const search = useGlobalPeopleSearch()
 * search.openFromHotkey()
 */
export function useGlobalPeopleSearch() {
  const store = usePeopleSearchStore()
  const { open, query, results, searching } = storeToRefs(store)

  const creating = ref(false)

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as any
    }
  })()

  const confirm = (() => {
    try {
      return useConfirm()
    } catch {
      return null as any
    }
  })()

  const { isOnline: presenceOnline } = usePresenceState()

  const hasQuery = computed(() => query.value.trim().length >= 2)

  /**
   * Онлайн ли человек из выдачи.
   * @param id id пользователя
   * @param lastSeenAt время последней активности
   * @returns true если онлайн
   */
  function isOnline(id?: number | null, lastSeenAt?: string | null): boolean {
    if (id == null) {
      return false
    }

    const found = results.value.find((item) => Number(item?.id) === Number(id))

    if (found?.is_invisible) {
      return false
    }

    if (presenceOnline(id)) {
      return true
    }

    return isRecentlySeen(lastSeenAt ?? found?.last_seen_at ?? null)
  }

  /**
   * Открыть диалог (вызывается из Ctrl+K).
   */
  function openFromHotkey(): void {
    store.openDialog()
  }

  /**
   * Начать чат с человеком из выдачи.
   * @param user найденный пользователь
   */
  async function startChat(user: any): Promise<void> {
    if (user?.can_message === false) {
      const detail = user?.can_message_reason || 'Пользователь не принимает сообщения'

      toast?.add({
        severity: 'warn',
        summary: 'Нельзя написать',
        detail,
        life: 3500,
      })

      return
    }

    creating.value = true

    try {
      const conversation = await chatApi.createConversation(user.id)

      store.closeDialog()
      router.visit(`/chat/${conversation.id}`)
    } catch (error: any) {
      const detail = error?.response?.data?.message || 'Не удалось создать чат'

      toast?.add({
        severity: 'error',
        summary: 'Ошибка',
        detail,
        life: 3500,
      })
    } finally {
      creating.value = false
    }
  }

  /**
   * Отправить заявку в друзья.
   * @param userId id пользователя
   */
  async function addFriend(userId: number): Promise<void> {
    try {
      await chatApi.addFriend(userId)

      const item = results.value.find((user: any) => Number(user?.id) === Number(userId))

      if (item) {
        item.is_pending = true
      }
    } catch (error: any) {
      const detail = error?.response?.data?.message || 'Не удалось отправить заявку'

      toast?.add({
        severity: 'error',
        summary: 'Ошибка',
        detail,
        life: 3500,
      })
    }
  }

  /**
   * Запросить подтверждение блокировки.
   * @param userId id пользователя
   * @param name имя для текста подтверждения
   */
  function askBlock(userId: number, name?: string): void {
    if (!confirm) {
      return
    }

    confirm.require({
      header: 'Заблокировать?',
      message: `Заблокировать ${name ?? 'пользователя'}? Чат и дружба будут удалены, сообщения скрыты.`,
      icon: 'pi pi-ban',
      acceptLabel: 'Заблокировать',
      rejectLabel: 'Отмена',
      accept: async () => {
        try {
          await chatApi.block(userId)
          results.value = results.value.filter((user: any) => Number(user?.id) !== Number(userId))
        } catch (error: any) {
          const detail = error?.response?.data?.message || 'Не удалось заблокировать'

          toast?.add({
            severity: 'error',
            summary: 'Ошибка',
            detail,
            life: 3500,
          })
        }
      },
    })
  }

  /**
   * Перейти в профиль человека и закрыть диалог.
   * @param userId id пользователя
   */
  function openProfile(userId: number): void {
    store.closeDialog()
    router.visit(`/users/${userId}`)
  }

  /**
   * Слушать событие `people-search:open` от Ctrl+K.
   */
  function onOpenEvent(): void {
    store.openDialog()
  }

  onMounted(() => {
    window.addEventListener('people-search:open', onOpenEvent)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('people-search:open', onOpenEvent)
  })

  return {
    open,
    query,
    results,
    searching,
    creating,
    hasQuery,
    isOnline,
    openFromHotkey,
    close: store.closeDialog,
    setQuery: store.setQuery,
    openProfile,
    startChat,
    addFriend,
    askBlock,
  }
}
