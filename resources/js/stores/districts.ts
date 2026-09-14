import { defineStore } from 'pinia'
import { ref } from 'vue'
import { districtsApi } from '@/services/districts.api'
import type { CreateDistrictPayload, District, DistrictDetails } from '@/types/entities/District'

/**
 * Стор UDistrict-районов: слой заливок на карте и диалоги.
 *
 * Список грузится по bbox вьюпорта (как пины), живые правки
 * прилетают сокетом map-канала и применяются точечно.
 */
export const useDistrictsStore = defineStore('districts', () => {
  const districts = ref<District[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saving = ref(false)

  /**
   * Подтянуть районы в прямоугольнике карты.
   *
   * @param bbox видимый прямоугольник
   */
  async function fetchInBbox(bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<District[]> {
    loading.value = true
    error.value = null
    try {
      districts.value = await districtsApi.list(bbox)
      return districts.value
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось загрузить районы'
      return districts.value
    } finally {
      loading.value = false
    }
  }

  /**
   * Создать район из заливки кисти.
   */
  async function createDistrict(payload: CreateDistrictPayload): Promise<DistrictDetails> {
    saving.value = true
    try {
      const created = await districtsApi.create(payload)
      upsertRealtime(created)
      return created
    } finally {
      saving.value = false
    }
  }

  /**
   * Точечно положить район из realtime (создание/правка).
   *
   * @param district карточка района с сокета
   */
  function upsertRealtime(district: District): void {
    const idx = districts.value.findIndex((d) => d.id === district.id)
    if (idx !== -1) {
      districts.value[idx] = { ...districts.value[idx], ...district }
    } else {
      districts.value.unshift(district)
    }
  }

  /**
   * Убрать район из слоя (удаление по realtime).
   *
   * @param id id района
   */
  function removeRealtime(id: number): void {
    districts.value = districts.value.filter((d) => d.id !== id)
  }

  return { districts, loading, error, saving, fetchInBbox, createDistrict, upsertRealtime, removeRealtime }
})
