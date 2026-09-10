import { ref, computed } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { avatarSrcFor } from '@/composables/useAvatar'
import { compressImageFile, MAX_PHOTO_INPUT_BYTES } from '@/utils/image'

/**
 * Загрузка аватара: валидация до 10 МБ, сжатие до 800px, отправка.
 * @returns состояние файла и helpers
 */
export function useAvatarUpload() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const avatarFile = ref<File | null>(null)
  const previewUrl = ref<string | null>(null)
  const uploading = ref(false)
  const avatarOk = ref(false)
  const showPreview = ref(false)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const avatarSrc = computed(() => {
    if (previewUrl.value) return previewUrl.value
    return avatarSrcFor(user.value)
  })

  function onAvatar(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    if (f.size > MAX_PHOTO_INPUT_BYTES) {
      toast?.add({ severity: 'error', summary: 'Фото больше 10 МБ', life: 2500 })
      return
    }
    avatarFile.value = f
    const r = new FileReader()
    r.onload = () => (previewUrl.value = r.result as string)
    r.readAsDataURL(f)
  }

  async function uploadAvatar() {
    if (!avatarFile.value) return
    uploading.value = true
    try {
      const small = await compressImageFile(avatarFile.value, 800, 0.84, 2 * 1024 * 1024)
      const fd = new FormData()
      fd.append('avatar', small)
      router.post(route('profile.avatar'), fd, {
        forceFormData: true,
        preserveScroll: true,
        onSuccess: () => {
          avatarFile.value = null
          previewUrl.value = null
          avatarOk.value = true
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

  return { user, avatarFile, previewUrl, uploading, avatarOk, showPreview, avatarSrc, onAvatar, uploadAvatar }
}
