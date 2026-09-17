import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useFlowStore } from '@/stores/flow'
import { flowApi } from '@/services/flow.api'
import type { FlowComment } from '@/types/flow'

/**
 * Ветка комментариев поста UFlow: список, ответы, удаление + infinite scroll.
 *
 * Первая страница грузится `load()`, дальше `loadMore()` по sentinel.
 * Новые ответы вшиваются в родителя, топ-комменты — в конец.
 *
 * @param postId пост
 * @example
 * const thread = useFlowComments(12)
 * await thread.load()
 * // <InfiniteSentinel :sentinel="thread.sentinel" :has-more="thread.hasMore" :loading="thread.loadingMore" />
 */
export function useFlowComments(postId: number) {
  const store = useFlowStore()
  const comments = ref<FlowComment[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const lastPage = ref(1)
  const sending = ref(false)
  const replyTo = ref<FlowComment | null>(null)
  const draft = ref('')
  const anonymousReply = ref(false)
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /**
   * Загрузить первую страницу комментариев.
   */
  async function load(): Promise<void> {
    loading.value = true
    hasMore.value = true
    try {
      const res = await flowApi.comments(postId, 1)
      comments.value = res.data
      page.value = res.current_page ?? 1
      lastPage.value = res.last_page ?? 1
      hasMore.value = page.value < lastPage.value
    } finally {
      loading.value = false
    }
  }

  /**
   * Догрузить следующую страницу для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMore(): Promise<boolean> {
    if (loading.value || loadingMore.value || !hasMore.value) return false
    loadingMore.value = true
    try {
      const next = page.value + 1
      const res = await flowApi.comments(postId, next)
      const rows = Array.isArray(res.data) ? res.data : []
      const known = new Set(comments.value.map((c) => c.id))
      const fresh = rows.filter((c) => !known.has(c.id))
      comments.value = [...comments.value, ...fresh]
      page.value = res.current_page ?? next
      lastPage.value = res.last_page ?? page.value
      hasMore.value = page.value < lastPage.value && rows.length > 0
      return fresh.length > 0
    } catch {
      return false
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * Выбрать комментарий для ответа.
   * @param comment комментарий или null для сброса
   */
  function setReply(comment: FlowComment | null): void {
    replyTo.value = comment
  }

  /**
   * Отправить комментарий или ответ.
   */
  async function send(): Promise<boolean> {
    const text = draft.value.trim()
    if (!text || sending.value) return false
    sending.value = true
    try {
      const created = await flowApi.comment(postId, {
        content: text,
        parent_id: replyTo.value?.id ?? null,
        is_anonymous: anonymousReply.value,
      })
      const parentId = created.parent_id
      if (parentId) {
        const parent = comments.value.find((item) => item.id === parentId)
        if (parent) {
          parent.replies = [...(parent.replies ?? []), created]
          parent.replies_count = (parent.replies_count ?? parent.replies.length - 1) + 1
        } else {
          await load()
        }
      } else {
        comments.value = [...comments.value, created]
      }
      store.applyCommentsDelta(postId, 1)
      draft.value = ''
      replyTo.value = null
      return true
    } catch (error) {
      const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не вышло отправить'
      toast?.add({ severity: 'error', summary: 'Ошибка', detail, life: 3000 })
      return false
    } finally {
      sending.value = false
    }
  }

  /**
   * Удалить комментарий (с ответами на сервере).
   * @param comment комментарий
   */
  async function remove(comment: FlowComment): Promise<void> {
    const isReply = !!comment.parent_id
    await flowApi.removeComment(comment.id)
    if (isReply) {
      const parent = comments.value.find((item) => item.id === comment.parent_id)
      if (parent?.replies) {
        parent.replies = parent.replies.filter((item) => item.id !== comment.id)
        parent.replies_count = Math.max(0, (parent.replies_count ?? 1) - 1)
        store.applyCommentsDelta(postId, -1)
        return
      }
    }
    const target = comments.value.find((item) => item.id === comment.id)
    const removed = 1 + (target?.replies?.length ?? 0)
    comments.value = comments.value.filter((item) => item.id !== comment.id)
    store.applyCommentsDelta(postId, -removed)
  }

  return { comments, loading, loadingMore, hasMore, sending, replyTo, draft, anonymousReply, load, loadMore, setReply, send, remove }
}
