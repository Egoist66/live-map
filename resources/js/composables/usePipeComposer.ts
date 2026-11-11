import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { usePipeStore } from '@/stores/pipe'
import { pipeApi } from '@/services/pipe.api'
import { useContentModeration } from '@/composables/useContentModeration'
import { useImageCompress } from '@/composables/useImageCompress'
import type { PipeThread } from '@/types/pipe'

export const PIPE_THREAD_MAX = 500
export const PIPE_IMAGES_MAX = 3

/** Выбранная картинка композера: файл для отправки + локальное превью. */
interface ComposerImage {
  file: File
  previewUrl: string
}

/**
 * Композер треда Pipe: создание в ленте и на странице треда.
 *
 * Текст до 500 символов + тумблер анонимности + до 3 картинок
 * (клиентски сжимаются compressImageFast — галерейные 1280/0.82).
 * Достаточно текста ИЛИ хотя бы одной картинки.
 *
 * @param onCreated колбэк после успешного поста (true = можно закрыть)
 * @example
 * const composer = usePipeComposer()
 * await composer.submit()
 */
export function usePipeComposer(onCreated?: (thread: PipeThread) => void) {
  const store = usePipeStore()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  const { compressImageFast } = useImageCompress()

  const body = ref('')
  const isAnonymous = ref(false)
  const saving = ref(false)
  const compressing = ref(false)
  const images = ref<ComposerImage[]>([])

  const me = computed(() => (usePage().props.auth as { user?: { id: number } }).user)
  const isGuest = computed(() => !me.value)

  const left = computed(() => PIPE_THREAD_MAX - body.value.length)
  const hasText = computed(() => body.value.trim().length > 0)
  const canSubmit = computed(() =>
    (hasText.value || images.value.length > 0)
    && body.value.length <= PIPE_THREAD_MAX
    && !saving.value
    && !compressing.value,
  )

  /** Слоты под картинки: сколько ещё можно добавить. */
  const freeSlots = computed(() => Math.max(0, PIPE_IMAGES_MAX - images.value.length))

  /**
   * Добавить картинки: клиентское сжатие (быстро и мало трафика),
   * сверх лимита — игнор с тостом. GIF конвертировать нельзя (полетит анимация).
   *
   * @param files выбранные файлы
   */
  async function addImages(files: File[] | null | undefined): Promise<void> {
    if (!files || files.length === 0) return

    const roomLeft = freeSlots.value
    const incoming = files.slice(0, roomLeft)

    if (files.length > roomLeft) {
      toast?.add({ severity: 'warn', summary: 'Лимит картинок', detail: `Можно прикрепить не больше ${PIPE_IMAGES_MAX}`, life: 2500 })
    }

    compressing.value = true
    try {
      for (const file of incoming) {
        const isAnimated = file.type === 'image/gif'
        const optimized = isAnimated ? file : await compressImageFast(file, 1280, 0.82)
        images.value = [...images.value, { file: optimized, previewUrl: URL.createObjectURL(optimized) }]
      }
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло обработать картинку', life: 2500 })
    } finally {
      compressing.value = false
    }
  }

  /**
   * Убрать картинку из черновика и освободить её object-URL.
   *
   * @param index позиция в списке
   */
  function removeImage(index: number): void {
    const target = images.value[index]
    if (!target) return

    URL.revokeObjectURL(target.previewUrl)
    images.value = images.value.filter((_, position) => position !== index)
  }

  /** Освободить все object-URL черновика. */
  function revokeAll(): void {
    for (const image of images.value) URL.revokeObjectURL(image.previewUrl)
    images.value = []
  }

  /** Сбросить черновик. */
  function reset(): void {
    body.value = ''
    isAnonymous.value = false
    revokeAll()
  }

  /**
   * Отправить тред. Возврат true — опубликовано, диалог можно закрывать.
   */
  async function submit(): Promise<boolean> {
    if (isGuest.value || !canSubmit.value) return false
    const text = body.value.trim()
    if (!text && images.value.length === 0) return false

    if (text) {
      const moderator = useContentModeration()
      const blockReason = moderator.assertPublishable(text)

      if (blockReason) {
        toast?.add({ severity: 'warn', summary: 'Модерация', detail: blockReason, life: 3500 })
        return false
      }
    }

    saving.value = true
    try {
      const created = await pipeApi.create({
        body: text,
        is_anonymous: isAnonymous.value,
        images: images.value.map((image) => image.file),
      })
      store.prependThread(created)
      reset()
      onCreated?.(created)
      return true
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      const detail = message?.errors?.body?.[0] ?? message?.message ?? 'Не вышло опубликовать тред'
      toast?.add({ severity: 'error', summary: 'Ошибка', detail, life: 4000 })
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    body, isAnonymous, saving, isGuest, left, canSubmit,
    images, freeSlots, compressing,
    addImages, removeImage, reset, submit,
  }
}
