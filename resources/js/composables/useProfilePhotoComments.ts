import { ref } from 'vue'
import { galleryCommentsApi, type GalleryComment } from '@/services/gallery.api'

export function useProfilePhotoComments(getPhotoId: () => number | null, onCount?: (n: number) => void) {
  const comments = ref<GalleryComment[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const draft = ref('')
  const error = ref<string | null>(null)
  let requestId = 0

  async function load() {
    const id = getPhotoId()
    if (!id) {
      comments.value = []
      error.value = null
      loading.value = false
      return
    }
    const current = ++requestId
    loading.value = true
    error.value = null
    try {
      const list = await galleryCommentsApi.list(id)
      if (current !== requestId || getPhotoId() !== id) return
      comments.value = list
      onCount?.(comments.value.length)
    } catch (e: any) {
      if (current !== requestId) return
      comments.value = []
      error.value = e?.response?.data?.message || 'Не удалось загрузить комментарии'
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  function reset() {
    requestId++
    comments.value = []
    error.value = null
    loading.value = false
    draft.value = ''
  }

  async function send(): Promise<boolean> {
    const id = getPhotoId()
    const text = draft.value.trim()
    if (!id || !text) return false
    sending.value = true
    error.value = null
    try {
      const created = await galleryCommentsApi.create(id, text)
      comments.value.push(created)
      draft.value = ''
      onCount?.(comments.value.length)
      return true
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось отправить комментарий'
      return false
    } finally {
      sending.value = false
    }
  }

  async function remove(id: number) {
    await galleryCommentsApi.remove(id)
    comments.value = comments.value.filter((c) => c.id !== id)
    onCount?.(comments.value.length)
  }

  return { comments, loading, sending, draft, error, load, send, remove, reset }
}
