import { ref } from 'vue'
import { galleryApi } from '@/services/gallery.api'

export const PHOTO_COMMENTS_OPTIONS = [
  { label: 'Все могут комментировать', value: 'everyone', icon: 'pi pi-globe' },
  { label: 'Только друзья', value: 'friends', icon: 'pi pi-users' },
  { label: 'Никто', value: 'none', icon: 'pi pi-lock' },
]

export function usePhotoCommentsPrivacy(initial: () => string) {
  const value = ref<string>(initial() || 'everyone')
  const saving = ref(false)
  const error = ref<string | null>(null)
  const saved = ref(false)

  async function save(v: string) {
    saving.value = true
    error.value = null
    try {
      const res = await galleryApi.updatePrivacy(v)
      value.value = res.photo_comments_privacy
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось сохранить'
    } finally {
      saving.value = false
    }
  }

  function sync(v: string) {
    value.value = v || 'everyone'
  }

  return { options: PHOTO_COMMENTS_OPTIONS, value, saving, error, saved, save, sync }
}
