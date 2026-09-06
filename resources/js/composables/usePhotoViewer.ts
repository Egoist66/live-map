import { ref, watch, type Ref } from 'vue'

interface PhotoLike {
  id: number
  caption?: string | null
}

interface GalleryLike {
  active: Ref<PhotoLike | null>
  toggleLike: (p: any) => Promise<unknown>
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

  async function onLike() {
    const p = gallery.active.value
    if (!p || likeLoading.value) return
    likeLoading.value = true
    try {
      await gallery.toggleLike(p)
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
    confirmDelete,
    likeLoading,
    saveLoading,
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
