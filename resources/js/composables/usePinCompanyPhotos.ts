import { ref, watch } from 'vue'
import { businessApi } from '@/services/business.api'
import type { BusinessPhoto } from '@/types/entities/Business'

const cache = new Map<number, BusinessPhoto[]>()

/**
 * Фото компании для карточки пина: листалка витрины.
 *
 * Грузит один раз на владельца (кэш в памяти), только для
 * бизнес-пинов с известным автором.
 *
 * @param getPin getter текущего пина
 * @returns фото и флаг загрузки
 * @example const gallery = usePinCompanyPhotos(() => pin)
 */
export function usePinCompanyPhotos(getPin: () => { is_business?: boolean; user?: { id?: number } | null } | null | undefined) {
  const photos = ref<BusinessPhoto[]>([])
  const loading = ref(false)

  async function load(): Promise<void> {
    const pin = getPin()
    const ownerId = Number(pin?.user?.id ?? 0)
    if (!pin?.is_business || !(ownerId > 0)) {
      photos.value = []
      return
    }
    const cached = cache.get(ownerId)
    if (cached) {
      photos.value = cached
      return
    }
    loading.value = true
    try {
      const list = await businessApi.photosByOwner(ownerId)
      cache.set(ownerId, list)
      photos.value = list
    } catch {
      photos.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    () => {
      const pin = getPin()
      return pin ? `${(pin as { id?: number }).id ?? 0}:${Number(pin?.user?.id ?? 0)}` : ''
    },
    () => {
      void load()
    },
    { immediate: true },
  )

  return { photos, loading, reload: load }
}
