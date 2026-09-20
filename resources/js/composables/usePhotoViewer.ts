import { computed, ref, watch, type Ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAnonymousLikePromo } from '@/composables/useAnonymousLikePromo'

interface PhotoLike {
  id: number
  caption?: string | null
}

interface GalleryLike {
  active: Ref<PhotoLike | null>
  toggleLike: (p: any, incognito?: boolean) => Promise<unknown>
  saveCaption: (p: any, caption: string | null) => Promise<unknown>
  replace: (p: any, file: File) => Promise<unknown>
  remove: (p: any) => Promise<unknown>
}

interface CommentsLike {
  load: () => void
  reset?: () => void
  send: () => void
}

export function usePhotoViewer(gallery: GalleryLike, comments: CommentsLike) {
  const editing = ref(false)
  const captionDraft = ref('')
  const replaceInput = ref<HTMLInputElement | null>(null)
  const confirmDelete = ref(false)
  const likeLoading = ref(false)
  const saveLoading = ref(false)
  const anonPromo = useAnonymousLikePromo()

  /**
   * Есть ли у юзера анонимные лайки: только PRO/Business/админ.
   * Нужно чтобы не показывать PRO-промо тем, у кого PRO уже есть.
   * @returns true если PRO/Business/админ
   */
  const canIncognito = computed(() => {
    try {
      const u = (usePage().props.auth as any)?.user
      if (!u) return false
      if (u.is_admin || u.role === 'admin') return true
      const plan = u.effective_plan || u.plan || 'free'
      return plan === 'pro' || plan === 'business'
    } catch { return false }
  })

  function setReplaceInput(el: unknown) {
    replaceInput.value = (el instanceof HTMLInputElement) ? el : null
  }

  watch(
    () => gallery.active.value,
    (p) => {
      editing.value = false
      captionDraft.value = p?.caption || ''
      if (p) comments.load()
      else comments.reset?.()
    },
    { immediate: true },
  )

  /**
   * Лайк активного фото (всегда открытый) + промо анонимных лайков при первом лайке.
   *
   * @returns результат toggleLike галереи
   */
  async function onLike() {
    const p = gallery.active.value
    if (!p || likeLoading.value) {
      return null
    }
    likeLoading.value = true
    try {
      const res = await gallery.toggleLike(p, false)
      const liked = !!(res as { liked?: boolean } | null)?.liked
      anonPromo.maybeShowOnFirstLike({ liked, canIncognito: canIncognito.value })
      return res
    } finally {
      likeLoading.value = false
    }
  }

  async function onSaveCaption() {
    const p = gallery.active.value
    if (!p) return
    saveLoading.value = true
    try {
      await gallery.saveCaption(p, captionDraft.value || null)
      editing.value = false
    } finally {
      saveLoading.value = false
    }
  }

  function startEdit() {
    captionDraft.value = gallery.active.value?.caption || ''
    editing.value = true
  }

  function cancelEdit() {
    editing.value = false
    captionDraft.value = gallery.active.value?.caption || ''
  }

  function onPickReplace() {
    replaceInput.value?.click()
  }

  async function onReplaceFile(e: Event) {
    const p = gallery.active.value
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!p || !f) return
    await gallery.replace(p, f)
    ;(e.target as HTMLInputElement).value = ''
  }

  async function onDelete() {
    const p = gallery.active.value
    if (!p) return
    await gallery.remove(p)
    confirmDelete.value = false
  }

  function onSend() {
    comments.send()
  }

  return {
    editing,
    captionDraft,
    replaceInput,
    setReplaceInput,
    confirmDelete,
    likeLoading,
    saveLoading,
    canIncognito,
    anonPromoVisible: anonPromo.promoVisible,
    closeAnonPromo: anonPromo.closePromo,
    onLike,
    onSaveCaption,
    startEdit,
    cancelEdit,
    onPickReplace,
    onReplaceFile,
    onDelete,
    onSend,
  }
}
