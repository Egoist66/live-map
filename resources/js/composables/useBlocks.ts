import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

export function useBlocks() {
  const blocked = ref<any[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try { const list = await chatApi.blocks(); blocked.value = Array.isArray(list) ? list.filter(Boolean) : [] } finally { loading.value = false }
  }

  async function block(userId: number) {
    const exists = blocked.value.some(b => Number(b?.blocked?.id ?? b?.blocked_id ?? b?.id) === Number(userId))
    const tmp = exists ? null : { id: Date.now(), blocked: { id: userId, name: `User ${userId}`, avatar_path: null }, _optimistic: true }
    if (tmp) blocked.value = [...blocked.value, tmp]
    try {
      await chatApi.block(userId)
      await load()
    } catch (e) {
      if (tmp) blocked.value = blocked.value.filter(b => !b?._optimistic)
      throw e
    }
  }

  async function unblock(userId: number) {
    const backup = [...blocked.value]
    blocked.value = blocked.value.filter(b => Number(b?.blocked?.id ?? b?.blocked_id) !== Number(userId))
    try {
      await chatApi.unblock(userId)
      await load()
    } catch (e) {
      blocked.value = backup
      throw e
    }
  }

  return { blocked, loading, load, block, unblock }
}
