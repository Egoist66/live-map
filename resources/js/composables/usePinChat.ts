import { ref, computed } from 'vue'
import { chatApi } from '@/services/chat.api'

export function usePinChat() {
  const statusMap = ref<Record<number, any>>({})
  const loadingId = ref<number | null>(null)

  async function loadStatus(userId: number) {
    if (!userId) return null
    try {
      const data = await chatApi.status(userId)
      statusMap.value[userId] = data
      return data
    } catch { return null }
  }

  async function addFriend(userId: number) {
    loadingId.value = userId
    try {
      await chatApi.addFriend(userId)
      await loadStatus(userId)
    } finally { loadingId.value = null }
  }

  async function startChat(userId: number) {
    loadingId.value = userId
    try {
      const res = await chatApi.createConversation(userId)
      window.location.href = `/chat/${res.id}`
    } finally { loadingId.value = null }
  }

  function getStatus(userId: number) { return statusMap.value[userId] || null }

  const canMessage = (userId: number) => {
    const s = getStatus(userId)
    return s ? s.can_message : true
  }

  const reason = (userId: number) => {
    const s = getStatus(userId)
    return s?.can_message_reason || ''
  }

  return { statusMap, loadingId, loadStatus, addFriend, startChat, getStatus, canMessage, reason }
}
