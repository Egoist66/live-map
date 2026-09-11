import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useFlowStore } from '@/stores/flow'
import { flowApi } from '@/services/flow.api'
import type { FlowComment } from '@/types/flow'

/**
 * Ветка комментариев поста UFlow: список, ответы, удаление.
 *
 * @param postId пост
 * @example
 * const thread = useFlowComments(12)
 * await thread.load()
 */
export function useFlowComments(postId: number) {
  const store = useFlowStore()
  const comments = ref<FlowComment[]>([])
  const loading = ref(false)
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
    try {
      const res = await flowApi.comments(postId, 1)
      comments.value = res.data
    } finally {
      loading.value = false
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

  return { comments, loading, sending, replyTo, draft, anonymousReply, load, setReply, send, remove }
}
