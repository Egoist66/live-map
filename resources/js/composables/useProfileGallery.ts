import { computed, ref } from 'vue'
import { galleryApi, type GalleryPhoto } from '@/services/gallery.api'
import { replaceUrlPreservingState } from '@/composables/useHistoryState'
import { useRewardToast } from '@/composables/useRewardToast'
import { useImageCompress } from '@/composables/useImageCompress'

/**
 * Лимиты галереи по тарифам: free — 5 бесплатных фото.
 */
export const GALLERY_LIMITS: Record<string, number> = { free: 5, pro: 6, premium: 15, business: 15 }

/**
 * Лимит галереи для тарифа.
 *
 * @param plan тариф пользователя
 * @param isAdmin админ — всегда 15
 * @returns лимит фото
 */
export function galleryLimitFor(plan?: string | null, isAdmin?: boolean): number {
  if (isAdmin) return 15
  if (plan === 'business' || plan === 'premium') return 15
  if (plan === 'pro') return 6
  return 5
}

export function useProfileGallery(userId: () => number, opts?: { isOwn?: boolean }) {
  const rewards = useRewardToast()
  const { compressImageFast } = useImageCompress()
  const photos = ref<GalleryPhoto[]>([])
  const limit = ref(5)
  const canAdd = ref(false)
  const canComment = ref(true)
  const privacy = ref('everyone')
  const loading = ref(false)
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const active = ref<GalleryPhoto | null>(null)
  const viewerOpen = ref(false)
  const dialogOpen = ref(false)
  const highlightCommentId = ref<number | null>(null)

  const count = computed(() => photos.value.length)
  const remaining = computed(() => Math.max(0, limit.value - count.value))
  const isFull = computed(() => count.value >= limit.value)

  /**
   * Главное фото галереи: совпадает с аватаром профиля.
   */
  const mainPhoto = computed(() => photos.value.find((p) => p.is_main) ?? null)

  /**
   * Ставит главное фото первым в локальном списке (бэк уже так отдаёт,
   * это страховка для фото, пришедших из upload/replace без сортировки).
   */
  function sortMainFirst(): void {
    const mains = photos.value.filter((p) => p.is_main)
    const rest = photos.value.filter((p) => !p.is_main)
    if (mains.length > 0) {
      photos.value = [...mains, ...rest]
    }
  }

  /**
   * Главное ли это фото (аватар профиля).
   *
   * @param photo фото для проверки
   * @returns true когда фото — главное
   */
  function isMainPhoto(photo: GalleryPhoto | null | undefined): boolean {
    return !!photo && !!photo.is_main
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await galleryApi.list(userId())
      photos.value = res.photos
      sortMainFirst()
      limit.value = res.limit
      canAdd.value = res.can_add
      canComment.value = res.can_comment
      privacy.value = res.photo_comments_privacy
      if (active.value) active.value = photos.value.find((p) => p.id === active.value?.id) ?? null
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить галерею'
    } finally {
      loading.value = false
    }
  }

  async function upload(file: File, caption?: string | null) {
    uploading.value = true
    error.value = null
    try {
      const small = await compressImageFast(file)
      const created = await galleryApi.upload(small, caption)
      rewards.applyReward(created)
      photos.value.unshift(created)
      sortMainFirst()
      await load()
      return created
    } catch (e: any) {
      error.value = e?.message || e?.response?.data?.message || 'Не удалось загрузить фото (макс 10 МБ)'
      throw e
    } finally {
      uploading.value = false
    }
  }

  async function saveCaption(photo: GalleryPhoto, caption: string | null) {
    const updated = await galleryApi.updateCaption(photo.id, caption)
    const i = photos.value.findIndex((p) => p.id === photo.id)
    if (i >= 0) photos.value[i] = updated
    if (active.value?.id === photo.id) active.value = updated
    return updated
  }

  async function replace(photo: GalleryPhoto, file: File) {
    const small = await compressImageFast(file)
    const updated = await galleryApi.replace(photo.id, small)
    const i = photos.value.findIndex((p) => p.id === photo.id)
    if (i >= 0) photos.value[i] = updated
    if (active.value?.id === photo.id) active.value = updated
    return updated
  }

  async function remove(photo: GalleryPhoto) {
    await galleryApi.remove(photo.id)
    photos.value = photos.value.filter((p) => p.id !== photo.id)
    if (active.value?.id === photo.id) {
      active.value = null
      viewerOpen.value = false
    }
  }

  /** Идёт ли сейчас смена главного фото (кнопка показывает спиннер). */
  const settingMain = ref(false)

  /**
   * Сделать фото главным: аватар профиля указывает на файл фото,
   * фото всплывает первым в галерее. Удалять ничего не нужно —
   * лимит не страдает.
   *
   * @param photo фото из своей галереи
   * @returns свежий avatar_url владельца
   */
  async function setMain(photo: GalleryPhoto): Promise<string | null> {
    settingMain.value = true
    error.value = null
    try {
      const updated = await galleryApi.makeMain(photo.id)
      for (const p of photos.value) {
        p.is_main = p.id === photo.id
      }
      const i = photos.value.findIndex((p) => p.id === photo.id)
      if (i >= 0) {
        photos.value[i] = { ...photos.value[i], ...updated, is_main: true }
      }
      sortMainFirst()
      if (active.value?.id === photo.id) {
        active.value = photos.value.find((p) => p.id === photo.id) ?? active.value
      }
      return updated.avatar_url ?? null
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.message || 'Не удалось сделать фото главным'
      throw e
    } finally {
      settingMain.value = false
    }
  }

  async function toggleLike(photo: GalleryPhoto, incognito = false) {
    const res = await galleryApi.toggleLike(photo.id, incognito)
    rewards.applyReward(res)
    const apply = (p: GalleryPhoto) => {
      p.liked = res.liked
      p.likes_count = res.likes_count
      p.liked_incognito = res.liked ? (res.is_incognito ?? incognito) : false
    }
    const i = photos.value.findIndex((p) => p.id === photo.id)
    if (i >= 0) apply(photos.value[i])
    if (active.value?.id === photo.id) apply(active.value)
    if (activeLikersPhotoId.value === photo.id && res.liked) void loadLikers(photo.id)
    if (activeLikersPhotoId.value === photo.id && !res.liked) likers.value = likers.value.filter((l) => l.user_id !== null || !l.is_incognito)
    return res
  }

  const likers = ref<Array<{ user_id: number | null; name: string; avatar_url: string | null; is_incognito: boolean; created_at?: string }>>([])
  const likersLoading = ref(false)
  const likersTotal = ref(0)
  const likersIncognito = ref(0)
  const activeLikersPhotoId = ref<number | null>(null)
  const likersOpen = ref(false)

  /**
   * Загрузить кто лайкнул фото (открытый список как в инсте).
   * @param photoId id фото
   */
  async function loadLikers(photoId: number) {
    likersLoading.value = true
    activeLikersPhotoId.value = photoId
    try {
      const res = await galleryApi.likers(photoId)
      likers.value = res.likers
      likersTotal.value = res.total
      likersIncognito.value = res.incognito_count
    } finally {
      likersLoading.value = false
    }
  }

  function openLikers(photo: GalleryPhoto) {
    likersOpen.value = true
    void loadLikers(photo.id)
  }

  function closeLikers() {
    likersOpen.value = false
  }

  function open(photo: GalleryPhoto, commentId?: number | null) {
    active.value = photo
    viewerOpen.value = true
    highlightCommentId.value = commentId ? Number(commentId) : null
    if (commentId) {
      setTimeout(() => {
        try { document.getElementById(`photo-comment-${commentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
      }, 500)
    }
  }

  /**
   * Листает фото вьювера по кругу: после последнего идёт первое.
   * @param dir направление: 1 — вперёд, -1 — назад
   */
  function stepPhoto(dir: 1 | -1) {
    const total = photos.value.length
    if (!total) {
      return
    }
    const current = photos.value.findIndex((x) => x.id === active.value?.id)
    const base = current >= 0 ? current : 0
    const next = (base + dir + total) % total
    active.value = photos.value[next]
  }

  function close() {
    viewerOpen.value = false
    highlightCommentId.value = null
  }

  function openDialog() {
    dialogOpen.value = true
    if (!photos.value.length && !loading.value) void load()
  }

  function closeDialog() {
    dialogOpen.value = false
  }

  function syncCounts(photoId: number, patch: Partial<GalleryPhoto>) {
    const i = photos.value.findIndex((p) => p.id === photoId)
    if (i >= 0) Object.assign(photos.value[i], patch)
    if (active.value?.id === photoId) Object.assign(active.value, patch)
  }

  async function consumePendingPhoto() {
    let photoId = 0
    let commentId: number | null = null
    try {
      const q = new URLSearchParams(window.location.search)
      photoId = Number(q.get('photo') || 0)
      commentId = Number(q.get('comment') || 0) || null
    } catch {}
    if (!photoId) {
      try {
        const raw = sessionStorage.getItem('live-map:pending-activity')
        if (raw) {
          const p = JSON.parse(raw)
          if (p?.type === 'photo' && Number(p.photoId)) {
            photoId = Number(p.photoId)
            commentId = Number(p.commentId) || null
          }
        }
      } catch {}
    }
    if (!photoId) return
    if (!photos.value.length) {
      try { await load() } catch {}
    }
    const target = photos.value.find((p) => Number(p.id) === Number(photoId))
    if (target) open(target, commentId)
    try { sessionStorage.removeItem('live-map:pending-activity') } catch {}
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('photo') || url.searchParams.has('comment')) {
        url.searchParams.delete('photo')
        url.searchParams.delete('comment')
        replaceUrlPreservingState(url.toString())
      }
    } catch {}
  }

  const MOSAIC_PATTERN = ['sm:col-span-2 sm:row-span-2', '', '', '', '', 'sm:col-span-2', '', '']

  function mosaicClass(i: number): string {
    return MOSAIC_PATTERN[i % MOSAIC_PATTERN.length]
  }

  return { photos, limit, count, remaining, isFull, canAdd, canComment, privacy, loading, uploading, error, active, viewerOpen, dialogOpen, highlightCommentId, isOwn: !!opts?.isOwn, mainPhoto, settingMain, isMainPhoto, setMain, load, upload, saveCaption, replace, remove, toggleLike, likers, likersLoading, likersTotal, likersIncognito, likersOpen, loadLikers, openLikers, closeLikers, open, stepPhoto, close, openDialog, closeDialog, syncCounts, consumePendingPhoto, mosaicClass }
}
