import { ref, computed } from 'vue'
import { useQuery, useQueryCache, useMutation } from '@pinia/colada'
import { commentsByPinQuery, COMMENT_KEYS } from '@/queries/comments'
import { PIN_KEYS } from '@/queries/pins'
import { commentsApi } from '@/services/comments.api'
import { useAppConfirm } from '@/composables/useAppConfirm'
import { isSameText } from '@/composables/useUnchangedGuard'
import { reactionsApi } from '@/services/reactions.api'
import { useRewardToast } from '@/composables/useRewardToast'
import { bindThreadLive } from '@/composables/useThreadLive'
import { pinsApi } from '@/services/pins.api'
import { formatTime } from '@/utils/date'
import { useToast } from 'primevue/usetoast'
import { useForm } from 'vee-validate'
import { createCommentSchema } from '@/validation/schemas/comment.schema'
import type { Pin, BoostType } from '@/types/entities/Pin'
import type { PinComment } from '@/types/entities/Comment'
import type { ReactionType } from '@/types/entities/Reaction'

/**
 * Ищет исходный текст комментария по id среди веток и ответов.
 *
 * @param rows ветки комментариев пина
 * @param id id комментария или ответа
 * @returns текст комментария или null когда не найден
 */
function findCommentContent(rows: PinComment[], id: number): string | null {
  for (const item of rows) {
    if (Number(item.id) === id) {
      return String((item as any).content ?? '')
    }
    const replies = Array.isArray((item as any).replies) ? (item as any).replies : []
    for (const reply of replies) {
      if (Number(reply.id) === id) {
        return String(reply.content ?? '')
      }
    }
  }
  return null
}

export function usePinDetails() {
  const selectedPin = ref<Pin | null>(null)
  const comments = ref<PinComment[]>([])
  const highlightCommentId = ref<number | null>(null)
  const editingCommentId = ref<number | null>(null)
  const editingContent = ref<string>('')
  const deletingCommentId = ref<number | null>(null)
  const replyTo = ref<PinComment | null>(null)
  let replyMention = ''
  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const rewards = useRewardToast()
  const cache = (() => { try { return useQueryCache() } catch { return null as any } })()
  const { confirmDelete } = useAppConfirm()

  const { defineField: defineCommentField, handleSubmit: handleCommentSubmit, errors: commentFormErrors, values: commentFormValues, resetForm: resetCommentForm } = useForm({
    validationSchema: createCommentSchema,
    initialValues: { content: '' } as any,
  })
  const [commentText, commentTextAttrs] = defineCommentField('content')

  const activePinId = computed(() => selectedPin.value?.id ?? null)

  const commentsPage = ref(1)
  const commentsLastPage = ref(1)
  const commentsHasMore = ref(true)
  const commentsLoadingMore = ref(false)

  const commentsQuery = useQuery(() => {
    const id = activePinId.value
    if (!id) return { key: ['comments', 'empty'] as any, query: () => Promise.resolve([]), enabled: false } as any
    return { ...commentsByPinQuery(id, 1), enabled: !!id } as any
  })

  async function loadComments(id: number): Promise<void> {
    commentsHasMore.value = true
    try {
      const res = await commentsApi.list(id, 1)
      comments.value = res.data
      commentsPage.value = res.current_page ?? 1
      commentsLastPage.value = res.last_page ?? 1
      commentsHasMore.value = commentsPage.value < commentsLastPage.value
      try { cache?.setQueryData(COMMENT_KEYS.byPin(id) as any, res.data as any) } catch {}
    } catch {
      comments.value = []
      commentsHasMore.value = false
    }
  }

  /**
   * Догрузить следующую страницу комментариев пина для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreComments(): Promise<boolean> {
    const id = activePinId.value
    if (!id || commentsLoadingMore.value || !commentsHasMore.value) return false
    commentsLoadingMore.value = true
    try {
      const next = commentsPage.value + 1
      const res = await commentsApi.list(id, next)
      const rows = res.data ?? []
      const known = new Set(comments.value.map((c) => c.id))
      const fresh = rows.filter((c) => !known.has(c.id))
      comments.value = [...comments.value, ...fresh]
      commentsPage.value = res.current_page ?? next
      commentsLastPage.value = res.last_page ?? commentsPage.value
      commentsHasMore.value = commentsPage.value < commentsLastPage.value && rows.length > 0
      return fresh.length > 0
    } catch { return false } finally { commentsLoadingMore.value = false }
  }

  function openPin(pin: Pin, commentId?: number | null): void {
    selectedPin.value = pin
    replyTo.value = null
    highlightCommentId.value = commentId ? Number(commentId) : null
    void loadComments(pin.id)
  }

  async function openPinById(pinId: number, commentId?: number | null): Promise<Pin | null> {
    const id = Number(pinId)
    if (!id) return null
    try {
      const { pinsApi } = await import('@/services/pins.api')
      const pin = await pinsApi.show(id)
      openPin(pin, commentId ?? null)
      return pin
    } catch {
      return null
    }
  }

  function closePin(): void { selectedPin.value = null; replyTo.value = null; highlightCommentId.value = null }

  /**
   * Живая ветка открытого пина: чужой коммент/ответ/правка/удаление
   * из шины перезагружает первую страницу. Сокет треда + добивка
   * watch_threads в поллинге несут один формат. Черновик vee-validate
   * и выбор ответа не трогаем. Глубже первой страницы не дёргаем —
   * там работает infinite scroll.
   */
  bindThreadLive({
    kind: 'pin',
    id: () => activePinId.value,
    knownMax: () => {
      let max = 0
      for (const c of comments.value as any[]) {
        const id = Number(c?.id ?? 0)
        if (id > max) max = id
        for (const r of c?.replies ?? []) {
          const rid = Number((r as any)?.id ?? 0)
          if (rid > max) max = rid
        }
      }
      return max
    },
    onChanged: () => {
      const id = activePinId.value
      if (id && commentsPage.value <= 1) void loadComments(id)
    },
    isOpen: () => selectedPin.value !== null,
  })

  const threadedComments = computed(() => {
    const list = (comments.value || []) as any[]
    const roots = list.filter((c) => !c.parent_id)
    if (!roots.length) return list
    const byId = new Map(list.map((c) => [c.id, c]))
    const findRoot = (c: any): any => {
      let cur = c
      const seen = new Set<number>()
      while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
        seen.add(cur.id)
        cur = byId.get(cur.parent_id)
      }
      return cur
    }
    roots.forEach((r: any) => {
      const nested = (r.replies || []) as any[]
      const have = new Set(nested.map((x: any) => x.id))
      const extra = list.filter((c: any) => c.parent_id && !have.has(c.id) && findRoot(c)?.id === r.id)
      if (extra.length) r.replies = [...nested, ...extra]
    })
    return roots
  })

  /**
   * Нацелить поле ввода на ответ: подставляет `@имя ` адресата.
   *
   * Ответ конкретному человеку начинается с ника автоматически,
   * обычный комментарий — чистый текст. Анониму ник не подставляется.
   * Повторный вызов сначала снимает старый авто-префикс.
   *
   * @param root корневой комментарий ветки
   * @param target конкретный адресат внутри ветки (по умолчанию корень)
   */
  function replyTarget(root: PinComment, target?: PinComment | null): void {
    replyTo.value = root
    const current = String(commentText.value || '')
    if (replyMention && current.startsWith(replyMention)) {
      commentText.value = current.slice(replyMention.length)
    }
    replyMention = ''
    const addressee = (target ?? root) as any
    const name = addressee.is_anonymous ? null : addressee.user?.name
    if (!name) {
      return
    }
    replyMention = `@${name} `
    const rest = String(commentText.value || '')
    if (!rest.startsWith(replyMention)) {
      commentText.value = `${replyMention}${rest}`
    }
  }

  /**
   * Снять ответ: убирает и авто-подставленный `@ник ` из поля.
   */
  function cancelReply(): void {
    replyTo.value = null
    const current = String(commentText.value || '')
    if (replyMention && current.startsWith(replyMention)) {
      commentText.value = current.slice(replyMention.length)
    }
    replyMention = ''
  }

  function useCommentsQuery(pinId: () => number | null) {
    return useQuery(() => {
      const id = pinId()
      if (!id) return { key: ['comments', 'empty'] as any, query: () => Promise.resolve([]), enabled: false } as any
      return { ...commentsByPinQuery(id), enabled: !!pinId() } as any
    })
  }

  const reactMutation = useMutation({
    mutation: ({ pin, type }: { pin: any; type: import('@/types/entities/Reaction').ReactionType }) => reactionsApi.toggle('pin', pin.id, type as any),
    onSuccess: (data: any, vars: any) => {
      const pin = (vars as any).pin
      if (typeof data.reactions_count === 'number') pin.reactions_count = data.reactions_count
      else if (data.reacted === false) pin.reactions_count = Math.max(0, (pin.reactions_count || 1) - 1)
      else if (data.reacted) pin.reactions_count = (pin.reactions_count || 0) + 1
      if (typeof data.likes_count === 'number') pin.likes_count = data.likes_count
      if ('type' in data) pin.my_reaction = data.type
      else if (data.reacted === false) pin.my_reaction = null
      rewards.applyReward(data)
      try { cache?.invalidateQueries({ key: PIN_KEYS.all() as any }) } catch {}
    },
  })

  async function react(pin: Pin, type: ReactionType = 'like'): Promise<void> {
    await (reactMutation as any).mutateAsync({ pin, type })
  }

  const createCommentMutation = useMutation({
    mutation: ({ pinId, content, parent_id }: { pinId: number; content: string; parent_id?: number | null }) => commentsApi.create(pinId, content, undefined, parent_id ?? null),
    onSuccess: (_data: any, vars: any) => {
      rewards.applyReward(_data)
      try { cache?.invalidateQueries({ key: COMMENT_KEYS.byPin((vars as any).pinId) as any }) } catch {}
    },
  })

  const sendComment = handleCommentSubmit(async (vals: any) => {
    if (!selectedPin.value) return
    const parentId = replyTo.value?.id ?? null
    await (createCommentMutation as any).mutateAsync({ pinId: selectedPin.value.id, content: vals.content, parent_id: parentId })
    resetCommentForm()
    replyTo.value = null
    replyMention = ''
    await loadComments(selectedPin.value.id)
    if (selectedPin.value) selectedPin.value.comments_count = (selectedPin.value.comments_count || 0) + 1
  })

  const boostMutation = useMutation({
    mutation: ({ pin, type }: { pin: Pin; type: BoostType }) => pinsApi.boost(pin.id, type),
  })

  async function boost(pin: Pin, type: BoostType): Promise<void> {
    await (boostMutation as any).mutateAsync({ pin, type })
    toast?.add({ severity: 'success', summary: 'Буст активирован: ' + type, life: 2000 })
  }

  const updateCommentMutation = useMutation({
    mutation: ({ id, content }: { id: number; content: string }) => commentsApi.update(id, content),
    onSuccess: (data: any, vars: any) => {
      const idx = comments.value.findIndex((x: any) => x.id === (vars as any).id)
      if (idx !== -1) comments.value[idx] = { ...comments.value[idx], ...data }
      try { if (selectedPin.value) cache?.invalidateQueries({ key: COMMENT_KEYS.byPin(selectedPin.value.id) as any }) } catch {}
    },
  })

  function startEditComment(c: PinComment): void { editingCommentId.value = c.id; editingContent.value = c.content }
  function cancelEditComment(): void { editingCommentId.value = null; editingContent.value = '' }
  async function saveEditComment(): Promise<void> {
    if (!editingCommentId.value) return
    if (!editingContent.value.trim()) { toast?.add({ severity: 'warn', summary: 'Пустой комментарий', life: 2000 }); return }
    const targetId = editingCommentId.value
    const original = findCommentContent(comments.value, targetId)
    if (original !== null && isSameText(editingContent.value, original)) {
      toast?.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
      cancelEditComment()
      return
    }
    try {
      await (updateCommentMutation as any).mutateAsync({ id: editingCommentId.value, content: editingContent.value.trim() })
      editingCommentId.value = null
      editingContent.value = ''
      toast?.add({ severity: 'success', summary: 'Комментарий обновлён', life: 2000 })
    } catch (e: any) { toast?.add({ severity: 'error', summary: e?.response?.data?.message || 'Лимит 3/день', life: 3000 }) }
  }

  /**
   * Удалить комментарий с подтверждением.
   *
   * Убирает комментарий и его ответы из локального списка, уменьшает
   * счётчик пина. Лимит на сервере: 3 удаления в день на Free,
   * на PRO и у админа — безлимитно (ошибка 429 показывается тостом).
   *
   * @param comment комментарий или ответ для удаления
   * @example
   * await deleteComment(root)
   */
  async function deleteComment(comment: PinComment): Promise<void> {
    const id = Number((comment as any)?.id ?? 0)
    if (!id || deletingCommentId.value) {
      return
    }
    const ok = await confirmDelete('Комментарий и ответы на него будут удалены навсегда.', 'Удалить комментарий?')
    if (!ok) {
      return
    }
    deletingCommentId.value = id
    try {
      await commentsApi.remove(id)
      let removedCount = 0
      const rest: PinComment[] = []
      for (const item of comments.value as any[]) {
        if (Number(item.id) === id) {
          removedCount += 1 + (item.replies?.length ?? 0)
          continue
        }
        const replies = Array.isArray(item.replies)
          ? item.replies.filter((reply: any) => Number(reply.id) !== id)
          : item.replies
        removedCount += (item.replies?.length ?? 0) - (replies?.length ?? 0)
        rest.push({ ...item, replies })
      }
      comments.value = rest
      if (editingCommentId.value === id) {
        cancelEditComment()
      }
      if (replyTo.value && Number(replyTo.value.id) === id) {
        replyTo.value = null
      }
      if (selectedPin.value) {
        const left = (selectedPin.value.comments_count || 0) - removedCount
        selectedPin.value.comments_count = Math.max(0, left)
      }
      try {
        if (selectedPin.value) cache?.invalidateQueries({ key: COMMENT_KEYS.byPin(selectedPin.value.id) as any })
      } catch {}
      toast?.add({ severity: 'success', summary: 'Комментарий удалён', life: 2000 })
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Не удалось удалить комментарий'
      toast?.add({ severity: 'error', summary: message, life: 4000 })
    } finally {
      deletingCommentId.value = null
    }
  }

  return {
    selectedPin, comments, threadedComments, replyTo, replyTarget, cancelReply, commentText, commentTextAttrs, commentFormErrors, editingCommentId, editingContent, deletingCommentId, highlightCommentId,
    openPin, openPinById, closePin, loadComments, loadMoreComments, commentsHasMore, commentsLoadingMore, react, sendComment, boost, startEditComment, cancelEditComment, saveEditComment, deleteComment, useCommentsQuery, formatTime,
    commentsQuery,
    reactMutation, reactStatus: (reactMutation as any).state, reactAsyncStatus: (reactMutation as any).asyncStatus,
    createCommentMutation, createCommentStatus: (createCommentMutation as any).state, createCommentAsyncStatus: (createCommentMutation as any).asyncStatus,
    boostMutation, updateCommentMutation,
    reactionLoading: computed(() => (reactMutation as any).asyncStatus?.value === 'loading'),
  }
}
