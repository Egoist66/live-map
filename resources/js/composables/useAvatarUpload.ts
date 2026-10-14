import { ref, computed } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { route } from '@/route'
import { useToast } from 'primevue/usetoast'
import { avatarSrcFor } from '@/composables/useAvatar'
import { invalidateImageUrl } from '@/composables/useImageBlobCache'
import { useAvatarCropper } from '@/composables/useAvatarCropper'
import { MAX_PHOTO_INPUT_BYTES } from '@/utils/image'
import { useImageCompress } from '@/composables/useImageCompress'

/**
 * Загрузка аватара: выбор → позиционирование в кропере → сжатие → отправка.
 * @returns состояние файла, кропер и helpers
 */
export function useAvatarUpload() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const avatarFile = ref<File | null>(null)
  const previewUrl = ref<string | null>(null)
  const uploading = ref(false)
  const confirming = ref(false)
  const avatarOk = ref(false)
  const showPreview = ref(false)
  const crop = useAvatarCropper()
  const { compressImageFast } = useImageCompress()
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const avatarSrc = computed(() => {
    if (previewUrl.value) return previewUrl.value
    return avatarSrcFor(user.value)
  })

  function onAvatar(e: Event) {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    if (f.size > MAX_PHOTO_INPUT_BYTES) {
      toast?.add({ severity: 'error', summary: 'Фото больше 10 МБ', life: 2500 })
      return
    }
    if (!f.type.startsWith('image/')) return
    avatarFile.value = null
    revokePreview()
    crop.openWithFile(f)
  }

  /**
   * Подтверждает кроп: режет квадрат и кладёт в превью.
   */
  async function confirmCrop() {
    if (!crop.sourceUrl.value || confirming.value) return
    confirming.value = true
    try {
      const cropped = await crop.exportCropped(640)
      if (!cropped) {
        toast?.add({ severity: 'error', summary: 'Не вышло обрезать фото', life: 2500 })
        return
      }
      avatarFile.value = cropped
      revokePreview()
      previewUrl.value = URL.createObjectURL(cropped)
      crop.close()
    } finally {
      confirming.value = false
    }
  }

  function cancelCrop() {
    crop.reset()
  }

  function revokePreview() {
    if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl.value)
    }
    previewUrl.value = null
  }

  async function uploadAvatar() {
    if (!avatarFile.value) return
    uploading.value = true
    // Старый URL для точечной инвалидации blob-кеша после успеха.
    const oldAvatar = avatarSrcFor(user.value)
    try {
      const small = await compressImageFast(avatarFile.value, 800, 0.84, 2 * 1024 * 1024)
      const fd = new FormData()
      fd.append('avatar', small)
      router.post(route('profile.avatar'), fd, {
        forceFormData: true,
        preserveScroll: true,
        onSuccess: () => {
          avatarFile.value = null
          revokePreview()
          crop.reset()
          avatarOk.value = true
          // Старый blob больше не валиден: новый avatar_url придёт с новым ?v=,
          // но старую запись чистим сразу, чтобы не висела мёртвым грузом.
          if (oldAvatar && !oldAvatar.startsWith('data:')) {
            void invalidateImageUrl(oldAvatar)
          }
          router.reload({ only: ['auth'] })
          toast?.add({ severity: 'success', summary: 'Аватар обновлён', life: 2000 })
          setTimeout(() => (avatarOk.value = false), 2500)
        },
        onError: () => {
          toast?.add({ severity: 'error', summary: 'Не удалось загрузить аватар', life: 2500 })
        },
        onFinish: () => (uploading.value = false),
      })
    } catch {
      uploading.value = false
      toast?.add({ severity: 'error', summary: 'Фото больше 10 МБ', life: 2500 })
    }
  }

  return { user, avatarFile, previewUrl, uploading, confirming, avatarOk, showPreview, avatarSrc, crop, onAvatar, confirmCrop, cancelCrop, uploadAvatar }
}
