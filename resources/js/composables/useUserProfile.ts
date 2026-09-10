import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { useToast } from 'primevue/usetoast'

export function useUserProfile(userId: number) {
  const loading = ref(false)
  const friendship = ref<any>(null)
  const isFriend = ref(false)
  const isPending = ref(false)
  const isBlocked = ref(false)
  const isBlockedBy = ref(false)
  const canMessage = ref(true)
  const reason = ref<string | null>(null)

  async function load() {
    try {
      const data = await chatApi.status(userId)
      friendship.value = data.friendship
      isFriend.value = data.is_friend
      isPending.value = data.is_pending
      isBlocked.value = !!data.is_blocked
      isBlockedBy.value = !!data.is_blocked_by
      canMessage.value = data.can_message
      reason.value = data.can_message_reason
    } catch {}
  }

  async function addFriend() {
    loading.value = true
    try { await chatApi.addFriend(userId); await load() } finally { loading.value = false }
  }

  async function removeFriend() {
    loading.value = true
    try {
      if (friendship.value?.id) await chatApi.removeFriend(friendship.value.id)
      else {
        const d = await chatApi.status(userId)
        if (d.friendship?.id) await chatApi.removeFriend(d.friendship.id)
      }
      await load()
    } finally { loading.value = false }
  }

  async function block() {
    loading.value = true
    try { await chatApi.block(userId); await load() } finally { loading.value = false }
  }

  async function unblock() {
    loading.value = true
    try { await chatApi.unblock(userId); await load() } finally { loading.value = false }
  }

  /**
   * Создать диалог и сразу открыть окно чата chat/id.
   *
   * @returns void
   */
  async function startChat() {
    loading.value = true
    try {
      const res = await chatApi.createConversation(userId)
      if (!res?.id) {
        throw new Error('Сервер не вернул чат')
      }
      router.visit(`/chat/${res.id}`)
    } catch (e: any) {
      try {
        useToast().add({ severity: 'error', summary: e?.response?.data?.message || 'Не удалось открыть чат', life: 3500 })
      } catch {}
    } finally { loading.value = false }
  }

  return { loading, friendship, isFriend, isPending, isBlocked, isBlockedBy, canMessage, reason, load, addFriend, removeFriend, block, unblock, startChat }
}
