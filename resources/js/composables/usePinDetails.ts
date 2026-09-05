import { ref, computed } from 'vue'
import { useQuery, useQueryCache, useMutation } from '@pinia/colada'
import { commentsByPinQuery, COMMENT_KEYS } from '@/queries/comments'
import { PIN_KEYS } from '@/queries/pins'
import { commentsApi } from '@/services/comments.api'
import { reactionsApi } from '@/services/reactions.api'
import { pinsApi } from '@/services/pins.api'
import { formatTime } from '@/utils/date'
import { useToast } from 'primevue/usetoast'
import { useForm } from 'vee-validate'
import { createCommentSchema } from '@/validation/schemas/comment.schema'
import type { Pin, BoostType } from '@/types/entities/Pin'
import type { PinComment } from '@/types/entities/Comment'
import type { ReactionType } from '@/types/entities/Reaction'

export function usePinDetails() {
  const selectedPin = ref<Pin | null>(null)
  const comments = ref<PinComment[]>([])
  const editingCommentId = ref<number | null>(null)
  const editingContent = ref<string>('')
  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const cache = (() => { try { return useQueryCache() } catch { return null as any } })()

  const { defineField: defineCommentField, handleSubmit: handleCommentSubmit, errors: commentFormErrors, values: commentFormValues, resetForm: resetCommentForm } = useForm({
    validationSchema: createCommentSchema,
    initialValues: { content: '' } as any,
  })
  const [commentText, commentTextAttrs] = defineCommentField('content')

  const activePinId = computed(() => selectedPin.value?.id ?? null)

  const commentsQuery = useQuery(() => {
    const id = activePinId.value
    if (!id) return { key: ['comments', 'empty'] as any, query: () => Promise.resolve([]), enabled: false } as any
    return { ...commentsByPinQuery(id), enabled: !!id } as any
  })

  async function loadComments(id: number): Promise<void> {
    try {
      const list = await commentsApi.list(id)
      comments.value = list
      try { cache?.setQueryData(COMMENT_KEYS.byPin(id) as any, list as any) } catch {}
    } catch {
      comments.value = []
    }
  }

  function openPin(pin: Pin): void {
    selectedPin.value = pin
    void loadComments(pin.id)
  }

  function closePin(): void { selectedPin.value = null }

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
      try { cache?.invalidateQueries({ key: PIN_KEYS.all() as any }) } catch {}
    },
  })

  async function react(pin: Pin, type: ReactionType = 'like'): Promise<void> {
    await (reactMutation as any).mutateAsync({ pin, type })
  }

  const createCommentMutation = useMutation({
    mutation: ({ pinId, content }: { pinId: number; content: string }) => commentsApi.create(pinId, content),
    onSuccess: (_data: any, vars: any) => {
      try { cache?.invalidateQueries({ key: COMMENT_KEYS.byPin((vars as any).pinId) as any }) } catch {}
    },
  })

  const sendComment = handleCommentSubmit(async (vals: any) => {
    if (!selectedPin.value) return
    await (createCommentMutation as any).mutateAsync({ pinId: selectedPin.value.id, content: vals.content })
    resetCommentForm()
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
    try {
      await (updateCommentMutation as any).mutateAsync({ id: editingCommentId.value, content: editingContent.value.trim() })
      editingCommentId.value = null
      editingContent.value = ''
      toast?.add({ severity: 'success', summary: 'Комментарий обновлён', life: 2000 })
    } catch (e: any) { toast?.add({ severity: 'error', summary: e?.response?.data?.message || 'Лимит 3/день', life: 3000 }) }
  }

  return {
    selectedPin, comments, commentText, commentTextAttrs, commentFormErrors, editingCommentId, editingContent,
    openPin, closePin, loadComments, react, sendComment, boost, startEditComment, cancelEditComment, saveEditComment, useCommentsQuery, formatTime,
    commentsQuery,
    reactMutation, reactStatus: (reactMutation as any).state, reactAsyncStatus: (reactMutation as any).asyncStatus,
    createCommentMutation, createCommentStatus: (createCommentMutation as any).state, createCommentAsyncStatus: (createCommentMutation as any).asyncStatus,
    boostMutation, updateCommentMutation,
    reactionLoading: computed(() => (reactMutation as any).asyncStatus?.value === 'loading'),
  }
}
