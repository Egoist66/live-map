import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

export function useBlocks() {
  const blocked = ref<any[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try { blocked.value = await chatApi.blocks() } finally { loading.value = false }
  }

  async function block(userId: number) {
    await chatApi.block(userId)
    await load()
  }

  async function unblock(userId: number) {
    await chatApi.unblock(userId)
    await load()
  }

  return { blocked, loading, load, block, unblock }
}
