import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { districtPostCommentsApi } from '@/services/district-posts.api'
import type { DistrictPostComment } from '@/types/entities/DistrictPost'

/**
 * Ветка комментариев новости района: список, ответы, удаление.
 *
 * Писать могут жители, читать — все, кто видит район.
 * Уведомления автору новости и родителя шлёт бэк.
 *
 * @param districtId id района
 * @param postId id новости
 * @param onDelta колбэк счётчика (+1/-N) для карточки
 * @example
 * const thread = useDistrictNewsComments(12, 34, (d) => news.applyCommentsDelta(34, d))
 * await thread.load()
 */
export function useDistrictNewsComments(
  districtId: number,
  postId: number,
  onDelta?: (delta: number) => void,
) {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  /** Ветки верхнего уровня. */
  const comments = ref<DistrictPostComment[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const replyTo = ref<DistrictPostComment | null>(null)
  const draft = ref('')

  /**
   * Загрузить первую страницу веток.
   */
  async function load(): Promise<void> {
    loading.value = true
    try {
      const res = await districtPostCommentsApi.list(districtId, postId, 1)
      comments.value = res.data
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло загрузить комментарии', life: 2500 })
    } finally {
      loading.value = false
    }
  }

  /**
   * Выбрать комментарий для ответа.
   *
   * @param comment ветка или null для сброса
   */
  function setReply(comment: DistrictPostComment | null): void {
    replyTo.value = comment
  }

  /**
   * Отправить комментарий или ответ.
   *
   * @returns true когда отправлено
   */
  async function send(): Promise<boolean> {
    const text = draft.value.trim()
    if (!text || sending.value) {
      return false
    }
    sending.value = true
    try {
      const created = await districtPostCommentsApi.create(districtId, postId, text, replyTo.value?.id ?? null)
      const parentId = created.parent_id
      if (parentId) {
        const parent = comments.value.find((item) => item.id === parentId)
        if (parent) {
          const nextReplies = [...(parent.replies ?? []), created]
          parent.replies = nextReplies
          parent.replies_count = nextReplies.length
        } else {
          await load()
        }
      } else {
        comments.value = [...comments.value, created]
      }
      onDelta?.(1)
      draft.value = ''
      replyTo.value = null
      return true
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло отправить', life: 3000 })
      return false
    } finally {
      sending.value = false
    }
  }

  /**
   * Удалить комментарий с ответами.
   *
   * @param comment ветка или ответ
   */
  async function remove(comment: DistrictPostComment): Promise<void> {
    try {
      await districtPostCommentsApi.remove(districtId, postId, comment.id)
      const topIndex = comments.value.findIndex((item) => item.id === comment.id)
      if (topIndex !== -1) {
        const removed = 1 + (comments.value[topIndex].replies?.length ?? 0)
        comments.value = comments.value.filter((item) => item.id !== comment.id)
        onDelta?.(-removed)
        return
      }
      let removedReply = false
      comments.value = comments.value.map((item) => {
        const hasReply = (item.replies ?? []).some((reply) => reply.id === comment.id)
        if (!hasReply) {
          return item
        }
        removedReply = true
        const nextReplies = (item.replies ?? []).filter((reply) => reply.id !== comment.id)
        return { ...item, replies: nextReplies, replies_count: nextReplies.length }
      })
      if (removedReply) {
        onDelta?.(-1)
      } else {
        await load()
      }
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло удалить', life: 3000 })
    }
  }

  return {
    comments,
    loading,
    sending,
    replyTo,
    draft,
    load,
    setReply,
    send,
    remove,
  }
}
