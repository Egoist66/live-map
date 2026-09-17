import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

/**
 * Поиск пользователей для приглашения в пин.
 *
 * @example
 * const { results, search } = useInviteUserSearch()
 * await search('анна')
 */
export function useInviteUserSearch() {
  const query = ref('')
  const results = ref<any[]>([])
  const searching = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function search(q: string): Promise<void> {
    query.value = q
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (q.trim().length < 2) {
      results.value = []
      searching.value = false
      return
    }
    searching.value = true
    await new Promise<void>((resolve) => {
      timer = setTimeout(() => resolve(), 300)
    })
    try {
      const res = await chatApi.search(q.trim())
      results.value = Array.isArray(res) ? res : (((res as { data?: unknown })?.data as unknown[] | undefined) ?? [])
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }

  return { query, results, searching, search }
}
