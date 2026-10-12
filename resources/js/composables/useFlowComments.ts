import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useFlowStore } from '@/stores/flow'
import { useRewardToast } from '@/composables/useRewardToast'
import { flowApi } from '@/services/flow.api'
import { useContentModeration } from '@/composables/useContentModeration'
import { bindThreadLive } from '@/composables/useThreadLive'
import type { FlowComment, FlowCommentsSort } from '@/types/flow'

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
  const rewards = useRewardToast()
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
  const sort = ref<FlowCommentsSort>('new')
  const childrenPage = ref<Record<number, number>>({})
  const childrenLast = ref<Record<number, number>>({})
  const childrenLoading = ref<Record<number, boolean>>({})
  let replyMention = ''
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /**
   * Загрузить первую страницу комментариев.
   *
   * Ошибка (нет доступа, пост скрыт) показывает тост вместо
   * необработанного rejection в консоли.
   */
  async function load(): Promise<void> {
    loading.value = true
    hasMore.value = true
    try {
      const res = await flowApi.comments(postId, 1, sort.value)
      comments.value = res.data
      page.value = res.current_page ?? 1
      lastPage.value = res.last_page ?? 1
      hasMore.value = page.value < lastPage.value
    } catch {
      toast?.add({ severity: 'error', summary: 'Не удалось загрузить комментарии', life: 2500 })
    } finally {
      loading.value = false
    }
  }

  /**
   * Сменить сортировку ветки и перезагрузить.
   * @param next new — сначала старые, top — сначала обсуждаемые
   */
  async function setSort(next: FlowCommentsSort): Promise<void> {
    if (sort.value === next) return
    sort.value = next
    await load()
  }

  /**
   * Есть ли ещё дети у ответа (3+ уровень ветки).
   * @param comment ответ
   */
  function hasMoreChildren(comment: FlowComment): boolean {
    const total = comment.replies_count ?? (comment.replies?.length ?? 0)
    const shown = comment.replies?.length ?? 0
    if (total <= shown) return false
    const last = childrenLast.value[comment.id] ?? 1
    const current = childrenPage.value[comment.id] ?? 0
    return current < last || (current === 0 && total > 0 && shown === 0)
  }

  /**
   * Грузятся ли дети ответа прямо сейчас.
   * @param comment ответ
   */
  function isLoadingChildren(comment: FlowComment): boolean {
    return !!childrenLoading.value[comment.id]
  }

  /**
   * Лениво подгрузить детей ответа (глубокая ветка).
   * @param comment ответ-родитель
   */
  async function loadChildren(comment: FlowComment): Promise<void> {
    const id = comment.id
    if (childrenLoading.value[id]) return
    const next = (childrenPage.value[id] ?? 0) + 1
    const last = childrenLast.value[id] ?? Number.MAX_SAFE_INTEGER
    if (next > last) return
    childrenLoading.value = { ...childrenLoading.value, [id]: true }
    try {
      const res = await flowApi.commentReplies(postId, id, next)
      const rows = Array.isArray(res.data) ? res.data : []
      const known = new Set((comment.replies ?? []).map((c) => c.id))
      const fresh = rows.filter((c) => !known.has(c.id))
      comment.replies = [...(comment.replies ?? []), ...fresh]
      childrenPage.value = { ...childrenPage.value, [id]: res.current_page ?? next }
      childrenLast.value = { ...childrenLast.value, [id]: res.last_page ?? next }
    } catch {
      toast?.add({ severity: 'error', summary: 'Не удалось загрузить ответы', life: 2500 })
    } finally {
      const rest = { ...childrenLoading.value }
      delete rest[id]
      childrenLoading.value = rest
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
      const res = await flowApi.comments(postId, next, sort.value)
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
   *
   * Ответ конкретному человеку начинается с `@имя `: ник подставляется
   * автоматически, обычный комментарий остаётся чистым. Анониму нечего
   * подставлять — у него нет ника. Сброс убирает только авто-префикс.
   *
   * @param comment комментарий или null для сброса
   */
  function setReply(comment: FlowComment | null): void {
    if (replyMention && draft.value.startsWith(replyMention)) {
      draft.value = draft.value.slice(replyMention.length)
    }
    replyMention = ''
    replyTo.value = comment
    if (!comment) {
      return
    }
    const targetName = comment.is_anonymous ? '' : (comment.author?.name || '')
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
   */
  async function send(): Promise<boolean> {
    const text = draft.value.trim()
    if (!text || sending.value) return false
    const moderator = useContentModeration()
    const blockReason = await moderator.assertPublishable(text)
    if (blockReason) {
      toast?.add({ severity: 'warn', summary: 'Модерация', detail: blockReason, life: 3500 })
      return false
    }
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
      rewards.applyReward(created)
      draft.value = ''
      replyTo.value = null
      replyMention = ''
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

  /**
   * Живая ветка: чужой коммент/ответ из шины перезагружает список.
   *
   * Сигнал идёт сокетом треда и добивкой watch_threads в поллинге —
   * оба транспорта несут один формат, черновик и ответ не трогаем,
   * отправка в полёте блокирует перезагрузку.
   *
   * @param isOpen открыта ли ветка прямо сейчас
   * @returns функция отписки для onUnmounted
   */
  function subscribeLive(isOpen: () => boolean): () => void {
    const maxId = () => {
      let max = 0
      for (const c of comments.value) {
        const id = Number((c as any)?.id ?? 0)
        if (id > max) max = id
        for (const r of (c as any)?.replies ?? []) {
          const rid = Number((r as any)?.id ?? 0)
          if (rid > max) max = rid
        }
      }
      return max
    }
    return bindThreadLive({
      kind: 'flow',
      id: () => postId,
      knownMax: maxId,
      onChanged: () => void load(),
      isOpen,
      isBusy: () => sending.value,
    })
  }

  return { comments, loading, loadingMore, hasMore, sending, replyTo, draft, anonymousReply, sort, load, loadMore, setSort, hasMoreChildren, isLoadingChildren, loadChildren, setReply, send, remove, subscribeLive }
}
