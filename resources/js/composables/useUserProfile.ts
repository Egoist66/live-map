import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'

export function useUserProfile(userId: number) {
  const loading = ref(false)
  const friendship = ref<any>(null)
  const isFriend = ref(false)
  const isPending = ref(false)
  const canMessage = ref(true)
  const reason = ref<string | null>(null)

  async function load() {
    try {
      const data = await chatApi.status(userId)
      friendship.value = data.friendship
      isFriend.value = data.is_friend
      isPending.value = data.is_pending
      canMessage.value = data.can_message
      reason.value = data.can_message_reason
    } catch {}
  }

  async function addFriend() {
    loading.value = true
    try { await chatApi.addFriend(userId); await load() } finally { loading.value = false }
  }

  async function startChat() {
    loading.value = true
    try {
      const res = await chatApi.createConversation(userId)
      router.visit(`/chat/${res.id}`)
    } finally { loading.value = false }
  }

  return { loading, friendship, isFriend, isPending, canMessage, reason, load, addFriend, startChat }
}
