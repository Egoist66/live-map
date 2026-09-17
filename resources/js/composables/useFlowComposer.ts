import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useFlowStore } from '@/stores/flow'
import { flowApi } from '@/services/flow.api'
import { isSameText } from '@/composables/useUnchangedGuard'

const MAX_BODY = 2000
const MAX_TITLE = 150

/**
 * Композер поста UFlow: создание и редактирование.
 *
 * Разовый анонимный пост доступен всем, тумблер
 * «всегда анонимно» — PRO (подсказка ведёт в биллинг).
 *
 * @example
 * const composer = useFlowComposer()
 * await composer.submit()
 */
export function useFlowComposer(existingId?: number | null) {
  const store = useFlowStore()
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
  const removeImage = ref(false)
  const saving = ref(false)
  const editingId = ref<number | null>(existingId ?? null)
  /** Снимок поста на момент startEdit для пропуска запроса без изменений. */
  const editSnapshot = ref<{ title: string; body: string; anonymous: boolean } | null>(null)

  const me = computed(() => (usePage().props.auth as { user?: { is_anonymous_default?: boolean; effective_plan?: string } }).user)
  const isPro = computed(() => {
    const plan = (me.value as { effective_plan?: string } | undefined)?.effective_plan ?? ''
    return plan === 'pro' || plan === 'business'
  })
  const bodyLeft = computed(() => MAX_BODY - body.value.length)
  const titleLeft = computed(() => MAX_TITLE - title.value.length)
  const canSubmit = computed(() => body.value.trim().length > 0 && body.value.length <= MAX_BODY && title.value.length <= MAX_TITLE && !saving.value)

  /**
   * Подставить файл картинки и превью.
   * @param file файл
   */
  function pickImage(file: File | null): void {
    image.value = file
    removeImage.value = false
    if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = file ? URL.createObjectURL(file) : null
  }

  /**
   * Убрать картинку.
   */
  function clearImage(): void {
    pickImage(null)
    removeImage.value = true
  }

  /**
   * Заполнить форму для редактирования.
   * @param postId пост
   * @param currentTitle заголовок
   * @param currentBody текст
   * @param anonymous анонимность
   * @param currentImageUrl текущая картинка поста или null
   */
  function startEdit(postId: number, currentTitle: string | null, currentBody: string, anonymous: boolean, currentImageUrl: string | null = null): void {
    editingId.value = postId
    title.value = currentTitle ?? ''
    body.value = currentBody
    isAnonymous.value = anonymous
    editSnapshot.value = { title: currentTitle ?? '', body: currentBody, anonymous }
    image.value = null
    removeImage.value = false
    if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = currentImageUrl
  }

  /**
   * Сбросить форму.
   */
  function reset(): void {
    title.value = ''
    body.value = ''
    isAnonymous.value = !!me.value?.is_anonymous_default && isPro.value
    pickImage(null)
    removeImage.value = false
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
    saving.value = true
    try {
      if (editingId.value) {
        const snapshot = editSnapshot.value
        const textsSame = snapshot !== null
          && isSameText(head, snapshot.title)
          && isSameText(text, snapshot.body)
          && isAnonymous.value === snapshot.anonymous
        if (textsSame && image.value === null && !removeImage.value) {
          toast?.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
          reset()
          return true
        }
        const updated = await flowApi.update(editingId.value, {
          title: head || null,
          body: text,
          is_anonymous: isAnonymous.value,
          image: image.value,
          remove_image: removeImage.value,
        })
        store.replace(updated)
      } else {
        const created = await flowApi.create({ title: head || null, body: text, is_anonymous: isAnonymous.value, image: image.value })
        store.prepend(created)
      }
      reset()
      return true
    } catch (error) {
      const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не вышло опубликовать'
      toast?.add({ severity: 'error', summary: 'Ошибка', detail, life: 3000 })
      return false
    } finally {
      saving.value = false
    }
  }

  if (!existingId) {
    isAnonymous.value = !!me.value?.is_anonymous_default && isPro.value
  }

  return { title, body, isAnonymous, image, imagePreview, removeImage, saving, editingId, isPro, bodyLeft, titleLeft, canSubmit, MAX_BODY, MAX_TITLE, pickImage, clearImage, startEdit, reset, submit }
}
