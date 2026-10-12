import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useFlowStore } from '@/stores/flow'
import { useRewardToast } from '@/composables/useRewardToast'
import { flowApi } from '@/services/flow.api'
import { downscaleImage } from '@/composables/useImageDownscale'
import { useContentModeration } from '@/composables/useContentModeration'
import { isSameText } from '@/composables/useUnchangedGuard'
import type { FlowPost, FlowMedia } from '@/types/flow'

const MAX_BODY = 2000
const MAX_TITLE = 150
const MAX_PHOTOS = 4
const MAX_POLL_OPTIONS = 4
/** Лимит видео как на сервере (50 МБ): проверяем до отправки. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

/** Длительность опроса для селектора композера. */
export const POLL_DURATION_OPTIONS = [
  { label: '1 час', value: 1 },
  { label: '24 часа', value: 24 },
  { label: '7 дней', value: 168 },
  { label: 'Без срока', value: null },
] as const

/**
 * Композер поста UFlow: создание и редактирование.
 *
 * Медиа: до 4 фото или одно видео (взаимоисключающе).
 * Опрос: 2–4 варианта + дедлайн, создаётся вместе с постом.
 * Разовый анонимный пост доступен всем, тумблер
 * «всегда анонимно» — PRO (подсказка ведёт в биллинг).
 *
 * @example
 * const composer = useFlowComposer()
 * await composer.submit()
 */
export function useFlowComposer(existingId?: number | null) {
  const store = useFlowStore()
  const rewards = useRewardToast()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  const body = ref('')
  const title = ref('')
  const isAnonymous = ref(false)
  const image = ref<File | null>(null)
  const imagePreview = ref<string | null>(null)
  const images = ref<File[]>([])
  const imagePreviews = ref<string[]>([])
  const video = ref<File | null>(null)
  const videoPreview = ref<string | null>(null)
  /** Серверное медиа поста в режиме правок (показываем весь набор, как в ленте). */
  const existingMedia = ref<FlowMedia[]>([])
  const removeImage = ref(false)
  const removeMedia = ref(false)
  const pollEnabled = ref(false)
  const pollOptions = ref<string[]>(['', ''])
  const pollCloses = ref<number | null>(24)
  const saving = ref(false)
  const editingId = ref<number | null>(existingId ?? null)
  /** Снимок поста на момент startEdit для пропуска запроса без изменений. */
  const editSnapshot = ref<{ title: string; body: string; anonymous: boolean } | null>(null)

  const me = computed(() => (usePage().props.auth as { user?: { is_anonymous_default?: boolean; effective_plan?: string } }).user)
  const isPro = computed(() => {
    const plan = (me.value as { effective_plan?: string } | undefined)?.effective_plan ?? ''
    return plan === 'pro' || plan === 'premium' || plan === 'business'
  })
  const bodyLeft = computed(() => MAX_BODY - body.value.length)
  const titleLeft = computed(() => MAX_TITLE - title.value.length)
  const pollFilled = computed(() => pollOptions.value.map((o) => o.trim()).filter((o) => o !== ''))
  const canSubmit = computed(() => body.value.trim().length > 0 && body.value.length <= MAX_BODY && title.value.length <= MAX_TITLE && !saving.value)

  /**
   * Подставить файл картинки и превью.
   * Картинка жмётся до веба, чтобы пройти серверные лимиты.
   * @param file файл или null для очистки
   */
  async function pickImage(file: File | null): Promise<void> {
    if (imagePreview.value) {
      URL.revokeObjectURL(imagePreview.value)
      imagePreview.value = null
    }
    if (!file) {
      image.value = null
      removeImage.value = false
      return
    }
    try {
      const ready = await downscaleImage(file)
      image.value = ready
      removeImage.value = false
      imagePreview.value = URL.createObjectURL(ready)
    } catch {
      image.value = null
      toast?.add({ severity: 'error', summary: 'Картинка не подошла', detail: 'Не вышло прочитать файл — попробуй JPG или PNG', life: 3000 })
    }
  }

  /**
   * Убрать картинку.
   */
  function clearImage(): void {
    void pickImage(null)
    removeImage.value = true
  }

  /**
   * Добавить фото в набор (до 4, видео при этом сбрасывается).
   * @param files выбранные файлы
   */
  async function pickImages(files: FileList | File[] | null): Promise<void> {
    if (!files) return
    clearVideo()
    const list = Array.from(files).slice(0, MAX_PHOTOS - images.value.length)
    for (const file of list) {
      try {
        const ready = await downscaleImage(file)
        images.value = [...images.value, ready]
        imagePreviews.value = [...imagePreviews.value, URL.createObjectURL(ready)]
      } catch {
        toast?.add({ severity: 'error', summary: 'Картинка не подошла', detail: 'Не вышло прочитать файл — попробуй JPG или PNG', life: 3000 })
      }
    }
  }

  /**
   * Убрать фото из набора по индексу.
   * @param index позиция
   */
  function removeImageAt(index: number): void {
    const preview = imagePreviews.value[index]
    if (preview?.startsWith('blob:')) {
      try { URL.revokeObjectURL(preview) } catch { /* превью уже нет */ }
    }
    images.value = images.value.filter((_, i) => i !== index)
    imagePreviews.value = imagePreviews.value.filter((_, i) => i !== index)
  }

  /**
   * Подставить видео (одно, фото при этом сбрасываются).
   *
   * Размер и тип проверяются сразу — сервер режет всё больше 50 МБ,
   * нет смысла гонять тяжёлый файл впустую.
   *
   * @param file файл или null для очистки
   */
  function pickVideo(file: File | null): void {
    clearImages()
    if (videoPreview.value?.startsWith('blob:')) {
      try { URL.revokeObjectURL(videoPreview.value) } catch { /* превью уже нет */ }
    }
    videoPreview.value = null
    video.value = null
    if (!file) {
      removeMedia.value = false
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast?.add({ severity: 'warn', summary: 'Видео не подошло', life: 3000 })
      return
    }
    if (file.type && !file.type.startsWith('video/')) {
      toast?.add({ severity: 'warn', summary: 'Видео не подошло', life: 3000 })
      return
    }
    video.value = file
    try {
      videoPreview.value = URL.createObjectURL(file)
    } catch {
      videoPreview.value = null
    }
  }

  /**
   * Убрать видео.
   */
  function clearVideo(): void {
    if (videoPreview.value?.startsWith('blob:')) {
      try { URL.revokeObjectURL(videoPreview.value) } catch { /* превью уже нет */ }
    }
    video.value = null
    videoPreview.value = null
  }

  /**
   * Убрать все новые фото.
   */
  function clearImages(): void {
    for (const preview of imagePreviews.value) {
      if (preview.startsWith('blob:')) {
        try { URL.revokeObjectURL(preview) } catch { /* превью уже нет */ }
      }
    }
    images.value = []
    imagePreviews.value = []
  }

  /**
   * Убрать всё медиа (в режиме правок помечает удаление серверного).
   */
  function clearMedia(): void {
    clearImages()
    clearVideo()
    removeMedia.value = true
  }

  /**
   * Пометить весь существующий набор к удалению (edit-режим):
   * новые строки и легаси-одиночку разом.
   */
  function dropExistingMedia(): void {
    clearMedia()
    removeImage.value = true
  }

  /**
   * Добавить пустой вариант опроса.
   */
  function addPollOption(): void {
    if (pollOptions.value.length >= MAX_POLL_OPTIONS) return
    pollOptions.value = [...pollOptions.value, '']
  }

  /**
   * Убрать вариант опроса по индексу (минимум два).
   * @param index позиция
   */
  function removePollOption(index: number): void {
    if (pollOptions.value.length <= 2) return
    pollOptions.value = pollOptions.value.filter((_, i) => i !== index)
  }

  /**
   * Заполнить форму для редактирования: весь серверный набор
   * (новые строки + легаси-одиночка) — как в ленте, а не одно фото.
   * @param post пост целиком
   */
  function startEdit(post: FlowPost): void {
    editingId.value = post.id
    title.value = post.title ?? ''
    body.value = post.body
    isAnonymous.value = post.is_anonymous
    editSnapshot.value = { title: post.title ?? '', body: post.body, anonymous: post.is_anonymous }
    image.value = null
    removeImage.value = false
    if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
    const serverMedia = Array.isArray(post.media) ? post.media.filter((m) => m?.url) : []
    if (serverMedia.length) {
      existingMedia.value = [...serverMedia]
    } else if (post.image_url) {
      existingMedia.value = [{ id: 0, kind: 'photo', url: post.image_url, duration_sec: null }]
    } else {
      existingMedia.value = []
    }
    clearImages()
    clearVideo()
    removeMedia.value = false
    pollEnabled.value = false
    pollOptions.value = ['', '']
    pollCloses.value = 24
  }

  /**
   * Сбросить форму.
   */
  function reset(): void {
    title.value = ''
    body.value = ''
    isAnonymous.value = !!me.value?.is_anonymous_default && isPro.value
    void pickImage(null)
    removeImage.value = false
    existingMedia.value = []
    clearImages()
    clearVideo()
    removeMedia.value = false
    pollEnabled.value = false
    pollOptions.value = ['', '']
    pollCloses.value = 24
    editingId.value = null
    editSnapshot.value = null
  }

  /**
   * Отправить: создать или обновить пост.
   */
  async function submit(): Promise<boolean> {
    const text = body.value.trim()
    const head = title.value.trim()
    if (!text || saving.value) return false
    const moderator = useContentModeration()
    const blockReason = await moderator.assertPublishable(`${head} ${text}`)
    if (blockReason) {
      toast?.add({ severity: 'warn', summary: 'Модерация', detail: blockReason, life: 3500 })
      return false
    }
    if (pollEnabled.value && pollFilled.value.length < 2) {
      toast?.add({ severity: 'warn', summary: 'Опрос', detail: 'Нужно минимум 2 варианта ответа', life: 2500 })
      return false
    }
    saving.value = true
    try {
      if (editingId.value) {
        const snapshot = editSnapshot.value
        const textsSame = snapshot !== null
          && isSameText(head, snapshot.title)
          && isSameText(text, snapshot.body)
          && isAnonymous.value === snapshot.anonymous
        if (textsSame && image.value === null && !removeImage.value && !images.value.length && !video.value && !removeMedia.value) {
          toast?.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
          reset()
          return true
        }
        const updated = await flowApi.update(editingId.value, {
          title: head || null,
          body: text,
          is_anonymous: isAnonymous.value,
          image: image.value,
          images: images.value,
          video: video.value,
          remove_image: removeImage.value,
          remove_media: removeMedia.value,
        })
        store.replace(updated)
      } else {
        const created = await flowApi.create({
          title: head || null,
          body: text,
          is_anonymous: isAnonymous.value,
          image: image.value,
          images: images.value,
          video: video.value,
          poll: pollEnabled.value
            ? { options: pollFilled.value, closes_in_hours: pollCloses.value }
            : null,
        })
        store.prepend(created)
        rewards.applyReward(created)
      }
      reset()
      return true
    } catch (error) {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: friendlySubmitError(error), life: 4000 })
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Человеческий текст ошибки публикации без внутренних деталей:
   * никаких имён файлов, типов и лимитов — только нейтральный итог.
   * @param error ошибка axios
   */
  function friendlySubmitError(error: unknown): string {
    const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response
    const errors = response?.data?.errors ?? {}
    if (errors.video?.length) {
      return 'Видео не подошло'
    }
    if (errors.images?.length || errors['images.0']?.length) {
      return 'Фото не подошло'
    }
    if (errors['poll.options']?.length) {
      return 'Опрос не подошёл'
    }
    return 'Не вышло опубликовать'
  }

  if (!existingId) {
    isAnonymous.value = !!me.value?.is_anonymous_default && isPro.value
  }

  return { title, body, isAnonymous, image, imagePreview, images, imagePreviews, video, videoPreview, existingMedia, removeImage, removeMedia, pollEnabled, pollOptions, pollCloses, pollFilled, saving, editingId, isPro, bodyLeft, titleLeft, canSubmit, MAX_BODY, MAX_TITLE, MAX_PHOTOS, MAX_POLL_OPTIONS, pickImage, clearImage, pickImages, removeImageAt, pickVideo, clearVideo, clearMedia, dropExistingMedia, addPollOption, removePollOption, startEdit, reset, submit }
}
