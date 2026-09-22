import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { businessApi } from '@/services/business.api'
import type { BusinessPhoto } from '@/types/entities/Business'

export const BUSINESS_PHOTOS_LIMIT = 10

/**
 * Фотографии компании в кабинете: список, загрузка, удаление.
 *
 * @returns фото, флаги и действия менеджера
 * @example const photos = useBusinessPhotos()
 */
export function useBusinessPhotos() {
  const toast = useToast()
  const photos = ref<BusinessPhoto[]>([])
  const loading = ref(false)
  const uploading = ref(false)
  const businessId = ref<number | null>(null)

  const canAdd = computed(() => photos.value.length < BUSINESS_PHOTOS_LIMIT)

  /**
   * Загрузить фото компании.
   * @param id id бизнеса
   */
  async function load(id: number): Promise<void> {
    businessId.value = id
    loading.value = true
    try {
      photos.value = await businessApi.listPhotos(id)
    } catch {
      photos.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Загрузить новый файл.
   * @param file картинка
   * @param caption подпись
   * @returns true если загружено
   */
  async function upload(file: File, caption?: string | null): Promise<boolean> {
    if (!businessId.value || uploading.value) {
      return false
    }
    if (!canAdd.value) {
      toast.add({ severity: 'warn', summary: 'Лимит фото', detail: `Максимум ${BUSINESS_PHOTOS_LIMIT} фото компании`, life: 3500 })
      return false
    }
    uploading.value = true
    try {
      const created = await businessApi.uploadPhoto(businessId.value, file, caption ?? null)
      photos.value = [...photos.value, created]
      toast.add({ severity: 'success', summary: 'Фото добавлено', detail: 'Гости увидят его в пинах компании', life: 3000 })
      return true
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.add({ severity: 'error', summary: 'Не загрузилось', detail: message ?? 'Попробуйте другой файл', life: 4000 })
      return false
    } finally {
      uploading.value = false
    }
  }

  /**
   * Удалить фото.
   * @param photoId id фото
   */
  async function remove(photoId: number): Promise<void> {
    if (!businessId.value) {
      return
    }
    try {
      await businessApi.deletePhoto(businessId.value, photoId)
      photos.value = photos.value.filter((photo) => photo.id !== photoId)
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.add({ severity: 'error', summary: 'Не удалилось', detail: message ?? 'Попробуйте позже', life: 3500 })
    }
  }

  return { photos, loading, uploading, canAdd, load, upload, remove }
}
