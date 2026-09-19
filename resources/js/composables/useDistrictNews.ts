import { ref, type Ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { districtPostsApi } from '@/services/district-posts.api'
import { useRewardToast } from '@/composables/useRewardToast'
import { useImageCompress } from '@/composables/useImageCompress'
import type { DistrictPost } from '@/types/entities/DistrictPost'
import { isSameText } from '@/composables/useUnchangedGuard'

/**
 * Новости района: лента, композер владельца, лайки.
 *
 * Создаёт только владелец, лайкают и комментируют жители.
 * Уведомления жителям рассылает бэк через DistrictNotifier.
 *
 * @param districtId id района
 * @param isOwner true для создателя района
 * @example
 * const news = useDistrictNews(12, page.isOwner)
 * await news.load()
 */
export function useDistrictNews(districtId: number, isOwner: Ref<boolean>) {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  /** Лента новостей. */
  const posts = ref<DistrictPost[]>([])
  const rewards = useRewardToast()
  const { compressImageFast } = useImageCompress()
  /** Грузится ли лента. */
  const loading = ref(false)
  /** Догрузка следующей страницы. */
  const loadingMore = ref(false)
  /** Есть ли ещё страницы. */
  const hasMore = ref(true)
  const page = ref(1)
  const lastPage = ref(1)
  /** Идёт ли публикация/сохранение. */
  const saving = ref(false)
  /** Занятые лайком посты. */
  const likeBusy = ref<Record<number, boolean>>({})

  /** Черновик композера владельца. */
  const title = ref('')
  const body = ref('')
  const image = ref<File | null>(null)
  const imagePreview = ref<string | null>(null)

  /** Редактируемый пост владельца. */
  const editingId = ref<number | null>(null)
  /** Снимок новости на момент startEdit для пропуска запроса без изменений. */
  const editSnapshot = ref<{ title: string; body: string } | null>(null)

  const bodyLeft = ref(2000)

  /**
   * Загрузить свежие новости района.
   */
  async function load(): Promise<void> {
    if (!(districtId > 0)) {
      return
    }
    loading.value = true
    hasMore.value = true
    try {
      const res = await districtPostsApi.list(districtId, 1)
      posts.value = res.data
      page.value = res.current_page ?? 1
      lastPage.value = res.last_page ?? 1
      hasMore.value = page.value < lastPage.value
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло загрузить новости', life: 2500 })
    } finally {
      loading.value = false
    }
  }

  /**
   * Догрузить следующую страницу новостей для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMore(): Promise<boolean> {
    if (!(districtId > 0) || loading.value || loadingMore.value || !hasMore.value) return false
    loadingMore.value = true
    try {
      const next = page.value + 1
      const res = await districtPostsApi.list(districtId, next)
      const rows = Array.isArray(res.data) ? res.data : []
      const known = new Set(posts.value.map((p) => p.id))
      const fresh = rows.filter((p) => !known.has(p.id))
      posts.value = [...posts.value, ...fresh]
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
   * Выбрать картинку композера.
   *
   * @param file картинка или null для сброса
   */
  function pickImage(file: File | null): void {
    if (imagePreview.value?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview.value)
    }
    image.value = null
    imagePreview.value = null
    if (file && file.type.startsWith('image/')) {
      image.value = file
      imagePreview.value = URL.createObjectURL(file)
    }
  }

  /**
   * Сбросить черновик композера.
   */
  function resetComposer(): void {
    title.value = ''
    body.value = ''
    bodyLeft.value = 2000
    pickImage(null)
    editingId.value = null
    editSnapshot.value = null
  }

  /**
   * Начать правку своей новости.
   *
   * @param post новость из ленты
   */
  function startEdit(post: DistrictPost): void {
    title.value = post.title ?? ''
    body.value = post.body
    bodyLeft.value = 2000 - body.value.length
    pickImage(null)
    editingId.value = post.id
    editSnapshot.value = { title: post.title ?? '', body: post.body }
  }

  /**
   * Опубликовать новость или сохранить правку (только владелец).
   *
   * @returns true когда лента обновлена
   */
  async function submit(): Promise<boolean> {
    if (!isOwner.value || saving.value) {
      return false
    }
    const cleanBody = body.value.trim()
    if (cleanBody.length < 2) {
      toast?.add({ severity: 'warn', summary: 'Пустая новость', detail: 'Напишите пару слов', life: 2500 })
      return false
    }
    saving.value = true
    try {
      const cleanTitle = title.value.trim() || null
      const snapshot = editSnapshot.value
      if (editingId.value && snapshot !== null && image.value === null) {
        const titleSame = isSameText(cleanTitle, snapshot.title)
        const bodySame = isSameText(cleanBody, snapshot.body)
        if (titleSame && bodySame) {
          toast?.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
          resetComposer()
          return true
        }
      }
      const small = image.value ? await compressImageFast(image.value, 1600, 0.82) : null
      if (editingId.value) {
        const updated = await districtPostsApi.update(districtId, editingId.value, {
          title: cleanTitle,
          body: cleanBody,
          image: small,
        })
        posts.value = posts.value.map((item) => (item.id === updated.id ? updated : item))
        toast?.add({ severity: 'success', summary: 'Новость обновлена', life: 2000 })
      } else {
        const created = await districtPostsApi.create(districtId, {
          title: cleanTitle,
          body: cleanBody,
          image: small,
        })
        posts.value = [created, ...posts.value]
        rewards.applyReward(created)
        toast?.add({ severity: 'success', summary: 'Новость опубликована', detail: 'Жители получат уведомление', life: 2500 })
      }
      resetComposer()
      return true
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло опубликовать', life: 3000 })
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Удалить новость (только владелец).
   *
   * @param postId id новости
   */
  async function remove(postId: number): Promise<void> {
    if (!isOwner.value) {
      return
    }
    try {
      await districtPostsApi.remove(districtId, postId)
      posts.value = posts.value.filter((item) => item.id !== postId)
      if (editingId.value === postId) {
        resetComposer()
      }
      toast?.add({ severity: 'success', summary: 'Новость удалена', life: 2000 })
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло удалить', life: 3000 })
    }
  }

  /**
   * Лайк/анлайк новости.
   *
   * @param postId id новости
   */
  async function toggleLike(postId: number): Promise<void> {
    if (likeBusy.value[postId]) {
      return
    }
    likeBusy.value = { ...likeBusy.value, [postId]: true }
    try {
      const res = await districtPostsApi.toggleLike(districtId, postId)
      rewards.applyReward(res)
      posts.value = posts.value.map((item) => {
        if (item.id !== postId) {
          return item
        }
        return { ...item, liked: res.liked, likes_count: res.likes_count }
      })
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло поставить лайк', life: 2500 })
    } finally {
      const next = { ...likeBusy.value }
      delete next[postId]
      likeBusy.value = next
    }
  }

  /**
   * Поднять счётчик комментариев после отправки.
   *
   * @param postId id новости
   * @param delta +1 отправлен, -N удалены
   */
  function applyCommentsDelta(postId: number, delta: number): void {
    posts.value = posts.value.map((item) => {
      if (item.id !== postId) {
        return item
      }
      const next = Math.max(0, (item.comments_count ?? 0) + delta)
      return { ...item, comments_count: next }
    })
  }

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    saving,
    likeBusy,
    title,
    body,
    bodyLeft,
    imagePreview,
    editingId,
    load,
    loadMore,
    pickImage,
    resetComposer,
    startEdit,
    submit,
    remove,
    toggleLike,
    applyCommentsDelta,
  }
}
