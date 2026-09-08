import { computed, ref } from 'vue'
import { galleryApi, type GalleryPhoto } from '@/services/gallery.api'

export const GALLERY_LIMITS: Record<string, number> = { free: 3, pro: 6, business: 15 }

export function galleryLimitFor(plan?: string | null, isAdmin?: boolean): number {
  if (isAdmin) return 15
  if (plan === 'business') return 15
  if (plan === 'pro') return 6
  return 3
}

export function useProfileGallery(userId: () => number, opts?: { isOwn?: boolean }) {
  const photos = ref<GalleryPhoto[]>([])
  const limit = ref(3)
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

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await galleryApi.list(userId())
      photos.value = res.photos
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
    try {
      const created = await galleryApi.upload(file, caption)
      photos.value.unshift(created)
      await load()
      return created
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
    const updated = await galleryApi.replace(photo.id, file)
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

  async function toggleLike(photo: GalleryPhoto) {
    const res = await galleryApi.toggleLike(photo.id)
    const apply = (p: GalleryPhoto) => {
      p.liked = res.liked
      p.likes_count = res.likes_count
    }
    const i = photos.value.findIndex((p) => p.id === photo.id)
    if (i >= 0) apply(photos.value[i])
    if (active.value?.id === photo.id) apply(active.value)
    return res
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

  function stepPhoto(dir: 1 | -1) {
    const i = photos.value.findIndex((x) => x.id === active.value?.id)
    const n = i + dir
    if (i >= 0 && n >= 0 && n < photos.value.length) active.value = photos.value[n]
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
        window.history.replaceState({}, '', url.toString())
      }
    } catch {}
  }

  const MOSAIC_PATTERN = ['sm:col-span-2 sm:row-span-2', '', '', '', '', 'sm:col-span-2', '', '']

  function mosaicClass(i: number): string {
    return MOSAIC_PATTERN[i % MOSAIC_PATTERN.length]
  }

  return { photos, limit, count, remaining, isFull, canAdd, canComment, privacy, loading, uploading, error, active, viewerOpen, dialogOpen, highlightCommentId, isOwn: !!opts?.isOwn, load, upload, saveCaption, replace, remove, toggleLike, open, stepPhoto, close, openDialog, closeDialog, syncCounts, consumePendingPhoto, mosaicClass }
}
