import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { districtPostCommentsApi } from '@/services/district-posts.api'
import type { DistrictPostComment } from '@/types/entities/DistrictPost'

/**
 * Ветка комментариев новости района: список, ответы, удаление + infinite scroll.
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
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const lastPage = ref(1)
  const sending = ref(false)
  const replyTo = ref<DistrictPostComment | null>(null)
  const draft = ref('')
  let replyMention = ''

  /**
   * Загрузить первую страницу веток.
   */
  async function load(): Promise<void> {
    loading.value = true
    hasMore.value = true
    try {
      const res = await districtPostCommentsApi.list(districtId, postId, 1)
      comments.value = res.data
      page.value = 1
      lastPage.value = res.last_page ?? 1
      hasMore.value = page.value < lastPage.value
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло загрузить комментарии', life: 2500 })
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
      const res = await districtPostCommentsApi.list(districtId, postId, next)
      const rows = Array.isArray(res.data) ? res.data : []
      const known = new Set(comments.value.map((c) => c.id))
      const fresh = rows.filter((c) => !known.has(c.id))
      comments.value = [...comments.value, ...fresh]
      page.value = next
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
   *
   * Ответ конкретному человеку начинается с `@имя `: ник подставляется
   * автоматически, обычный комментарий остаётся чистым.
   * Сброс убирает только авто-префикс.
   *
   * @param comment ветка или null для сброса
   */
  function setReply(comment: DistrictPostComment | null): void {
    if (replyMention && draft.value.startsWith(replyMention)) {
      draft.value = draft.value.slice(replyMention.length)
    }
    replyMention = ''
    replyTo.value = comment
    if (!comment) {
      return
    }
    const targetName = comment.author?.name || ''
    if (!targetName) {
      return
    }
    replyMention = `@${targetName} `
    if (!draft.value.startsWith(replyMention)) {
      draft.value = `${replyMention}${draft.value}`
    }
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
      replyMention = ''
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
    loadingMore,
    hasMore,
    sending,
    replyTo,
    draft,
    load,
    loadMore,
    setReply,
    send,
    remove,
  }
}
