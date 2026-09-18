import { ref } from 'vue'
import { galleryCommentsApi, type GalleryComment } from '@/services/gallery.api'

/**
 * Адресат ответа в комментариях фото: тредов нет (API плоский),
 * ответ — это упоминание `@имя ` в начале текста (бэк рассылает
 * уведомления по извлечённым упоминаниям).
 */
export interface PhotoReplyTarget {
  id: number
  name: string
}

/**
 * Комментарии фото профиля: список, отправка, удаление + ответ-упоминание.
 *
 * Ответ конкретному человеку подставляет `@имя ` в начало черновика,
 * обычный комментарий остаётся чистым. Сброс убирает только авто-префикс.
 *
 * @param getPhotoId геттер id активного фото
 * @param onCount колбэк счётчика для галереи
 * @example
 * const comments = useProfilePhotoComments(() => gallery.active.value?.id)
 * comments.setReply({ id: c.id, name: c.user?.name ?? '' })
 */
export function useProfilePhotoComments(getPhotoId: () => number | null, onCount?: (n: number) => void) {
  const comments = ref<GalleryComment[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const draft = ref('')
  const error = ref<string | null>(null)
  const replyTo = ref<PhotoReplyTarget | null>(null)
  let replyMention = ''
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
    replyTo.value = null
    replyMention = ''
  }

  /**
   * Выбрать адресата ответа: подставляет `@имя ` в черновик.
   *
   * @param target адресат или null для сброса
   */
  function setReply(target: PhotoReplyTarget | null): void {
    if (replyMention && draft.value.startsWith(replyMention)) {
      draft.value = draft.value.slice(replyMention.length)
    }
    replyMention = ''
    replyTo.value = target
    if (!target) {
      return
    }
    const targetName = (target.name || '').trim()
    if (!targetName) {
      return
    }
    replyMention = `@${targetName} `
    if (!draft.value.startsWith(replyMention)) {
      draft.value = `${replyMention}${draft.value}`
    }
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
      replyTo.value = null
      replyMention = ''
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

  return { comments, loading, sending, draft, error, replyTo, load, send, remove, reset, setReply }
}
