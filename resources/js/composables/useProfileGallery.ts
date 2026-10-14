import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { galleryApi, type GalleryIndex, type GalleryPhoto } from '@/services/gallery.api'
import { replaceUrlPreservingState } from '@/composables/useHistoryState'
import { useRewardToast } from '@/composables/useRewardToast'
import { useImageCompress } from '@/composables/useImageCompress'
import { busEmit, busOn } from '@/services/realtime-bus'
import { currentAuthUid } from '@/composables/useAuthUid'
import { ensureUserChannel } from '@/composables/useUserChannel'
import {
  loadCachedGallery,
  patchCachedPhoto,
  removeCachedPhoto,
  saveGallery,
} from '@/composables/useGalleryCache'
import { invalidateImageUrl, prefetchImageUrls } from '@/composables/useImageBlobCache'

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
  let galleryBusOff: (() => void) | null = null
  let lastGalleryVersion = 0

  /**
   * Применить индекс галереи к состоянию (кеш и сеть идут сюда же).
   *
   * @param res ответ galleryApi.list или кеш
   */
  function applyGalleryIndex(res: GalleryIndex): void {
    photos.value = res.photos
    sortMainFirst()
    limit.value = res.limit
    canAdd.value = res.can_add
    canComment.value = res.can_comment
    privacy.value = res.photo_comments_privacy
    if (active.value) active.value = photos.value.find((p) => p.id === active.value?.id) ?? null
  }

  /**
   * Прогреть бинарный кеш thumbs сетки (фон, без блокировки).
   *
   * @param list фото галереи
   */
  function warmGalleryCache(list: GalleryPhoto[]): void {
    const urls: string[] = []
    for (const photo of list) {
      const url = photo?.thumb_url || photo?.url
      if (url) {
        urls.push(url)
      }
      if (urls.length >= 15) {
        break
      }
    }
    if (urls.length > 0) {
      void prefetchImageUrls(urls)
    }
  }

  /**
   * Оповестить шину об изменении галереи (своя мутация).
   *
   * Формат user:* — тот же, что приходит с сокета `gallery.changed`
   * и из polling-тика: другие хуки на этом устройстве обновляются
   * без различия транспорта. Версия фиксируется до эмита, чтобы
   * собственная подписка (ниже) не устраивала повторный load после
   * только что выполненной мутации.
   */
  function notifyGalleryChanged(): void {
    const version = Date.now()
    lastGalleryVersion = version
    try {
      busEmit('user:gallery.changed', { user_id: currentAuthUid(), ownerId: userId(), version })
    } catch {}
  }

  /**
   * Ревалидация по событию шины: сокет в socket-режиме, polling-тик
   * в polling-режиме, своя мутация с соседнего хука. Источник не важен —
   * ключ один, поэтому инвалидация работает при выключенном поллинге.
   *
   * @param e событие {user_id|ownerId, version}
   */
  function handleGalleryChanged(e: { user_id?: number; ownerId?: number; version: number }): void {
    const owner = Number((e as any)?.ownerId ?? (e as any)?.user_id ?? 0)
    if (!(owner > 0) || owner !== Number(userId())) {
      return
    }
    const version = Number((e as any)?.version ?? 0)
    if (version > 0 && version <= lastGalleryVersion) {
      return
    }
    lastGalleryVersion = version
    void load()
  }

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
    const viewerUid = currentAuthUid()
    const ownerId = userId()
    let cacheHit = false
    if (viewerUid > 0 && ownerId > 0 && photos.value.length === 0) {
      try {
        const cached = await loadCachedGallery(viewerUid, ownerId)
        if (cached && Array.isArray(cached.photos) && cached.photos.length > 0) {
          applyGalleryIndex(cached)
          cacheHit = true
        }
      } catch {}
    }
    // Кеш есть — рисуем мгновенно без лоадера, сеть идёт тихим фоном.
    // Лоадер только при полном промахе, иначе «галерея мигает» при каждом открытии.
    loading.value = !cacheHit
    error.value = null
    try {
      const res = await galleryApi.list(ownerId)
      // Точечная проверка: identical id-set + cover — пропускаем лишние
      // перерисовки и перезапись кеша, HTTP при этом уже случился,
      // но UI не дёргается.
      if (cacheHit && isSameGallery(photos.value, res.photos)) {
        applyGalleryIndex(res)
        return
      }
      applyGalleryIndex(res)
      if (viewerUid > 0 && ownerId > 0) {
        void saveGallery(viewerUid, ownerId, res)
        warmGalleryCache(res.photos)
      }
    } catch (e: any) {
      // Офлайн с кешем — не ошибка, а штатный режим: показываем кеш молча.
      if (!cacheHit) {
        error.value = e?.response?.data?.message || 'Не удалось загрузить галерею'
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * Совпадает ли набор фото (id + cover + счётчики лайков).
   *
   * @param current текущие фото на экране
   * @param fresh свежие фото с сервера
   * @returns true когда перерисовка не нужна
   */
  function isSameGallery(current: GalleryPhoto[], fresh: GalleryPhoto[]): boolean {
    if (current.length !== fresh.length) {
      return false
    }
    for (let index = 0; index < fresh.length; index += 1) {
      const oldPhoto = current[index]
      const newPhoto = fresh[index]
      if (Number(oldPhoto?.id) !== Number(newPhoto?.id)) {
        return false
      }
      if (Boolean(oldPhoto?.is_main) !== Boolean(newPhoto?.is_main)) {
        return false
      }
      if (Number(oldPhoto?.likes_count ?? 0) !== Number(newPhoto?.likes_count ?? 0)) {
        return false
      }
      const oldUrl = oldPhoto?.thumb_url || oldPhoto?.url
      const newUrl = newPhoto?.thumb_url || newPhoto?.url
      if (oldUrl !== newUrl) {
        return false
      }
    }
    return true
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
      notifyGalleryChanged()
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
    const viewerUid = currentAuthUid()
    if (viewerUid > 0) {
      void patchCachedPhoto(viewerUid, userId(), updated)
    }
    notifyGalleryChanged()
    return updated
  }

  async function replace(photo: GalleryPhoto, file: File) {
    const small = await compressImageFast(file)
    const updated = await galleryApi.replace(photo.id, small)
    const i = photos.value.findIndex((p) => p.id === photo.id)
    if (i >= 0) photos.value[i] = updated
    if (active.value?.id === photo.id) active.value = updated
    const viewerUid = currentAuthUid()
    if (viewerUid > 0) {
      void patchCachedPhoto(viewerUid, userId(), updated)
    }
    void invalidateImageUrl(photo.url)
    if (photo.thumb_url) {
      void invalidateImageUrl(photo.thumb_url)
    }
    notifyGalleryChanged()
    return updated
  }

  async function remove(photo: GalleryPhoto) {
    await galleryApi.remove(photo.id)
    photos.value = photos.value.filter((p) => p.id !== photo.id)
    if (active.value?.id === photo.id) {
      active.value = null
      viewerOpen.value = false
    }
    const viewerUid = currentAuthUid()
    if (viewerUid > 0) {
      void removeCachedPhoto(viewerUid, userId(), photo.id)
    }
    void invalidateImageUrl(photo.url)
    if (photo.thumb_url) {
      void invalidateImageUrl(photo.thumb_url)
    }
    notifyGalleryChanged()
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
      const viewerUid = currentAuthUid()
      if (viewerUid > 0) {
        void patchCachedPhoto(viewerUid, userId(), { ...updated, is_main: true })
      }
      notifyGalleryChanged()
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
    const viewerUid = currentAuthUid()
    if (viewerUid > 0 && i >= 0) {
      void patchCachedPhoto(viewerUid, userId(), photos.value[i])
    }
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

  onMounted(() => {
    try {
      galleryBusOff = busOn('user:gallery.changed', handleGalleryChanged)
    } catch {}
    try {
      ensureUserChannel()
    } catch {}
  })

  onBeforeUnmount(() => {
    try {
      galleryBusOff?.()
    } catch {}
    galleryBusOff = null
  })

  return { photos, limit, count, remaining, isFull, canAdd, canComment, privacy, loading, uploading, error, active, viewerOpen, dialogOpen, highlightCommentId, isOwn: !!opts?.isOwn, mainPhoto, settingMain, isMainPhoto, setMain, load, upload, saveCaption, replace, remove, toggleLike, likers, likersLoading, likersTotal, likersIncognito, likersOpen, loadLikers, openLikers, closeLikers, open, stepPhoto, close, openDialog, closeDialog, syncCounts, consumePendingPhoto, mosaicClass }
}
