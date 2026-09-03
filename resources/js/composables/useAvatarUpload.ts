import { ref, computed } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { avatarSrcFor } from '@/composables/useAvatar'

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
    avatarFile.value = f
    const r = new FileReader()
    r.onload = () => (previewUrl.value = r.result as string)
    r.readAsDataURL(f)
  }

  function uploadAvatar() {
    if (!avatarFile.value) return
    uploading.value = true
    const fd = new FormData()
    fd.append('avatar', avatarFile.value)
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
      onFinish: () => (uploading.value = false),
    })
  }

  return { user, avatarFile, previewUrl, uploading, avatarOk, showPreview, avatarSrc, onAvatar, uploadAvatar }
}
