import { ref } from 'vue'
import { usePinsStore } from '@/stores/pins'
import { useSosStore } from '@/stores/sos'
import { syncRealtimeNow } from '@/composables/useRealtimePoller'

/**
 * Ручное обновление карты: лента пинов + SOS-статус + перерисовка маркеров.
 *
 * Тянет свежие пины вокруг текущего центра карты, подхватывает выход
 * из SOS-изоляции (закрытый пин сразу исчезает) и мгновенно
 * перерисовывает маркеры — без ожидания тика поллинга или moveend.
 *
 * @param mapApi api карты из useMapPage (getCenter/map/renderPins)
 * @returns флаг загрузки и действие обновления
 * @example
 * const mapRefresh = useMapRefresh(mapApi)
 * await mapRefresh.refreshMap()
 */
export function useMapRefresh(mapApi: any) {
  const store = usePinsStore()
  const sos = useSosStore()
  const refreshing = ref(false)

  /**
   * Обновить карту вручную вокруг текущего центра.
   */
  async function refreshMap(): Promise<void> {
    if (refreshing.value) {
      return
    }
    refreshing.value = true
    try {
      try {
        syncRealtimeNow()
      } catch {}
      try {
        await sos.load()
      } catch {}
      const center = mapApi?.map?.getCenter?.() ?? mapApi?.getCenter?.()
      const lat = Number(center?.lat)
      const lng = Number(center?.lng)
      const hasCenter = Number.isFinite(lat) && Number.isFinite(lng)
      if (hasCenter) {
        try {
          await store.fetchNearby(lat, lng)
        } catch {}
      } else {
        try {
          store.pruneExpired()
        } catch {}
      }
      const sosPinId = Number(sos.active?.pin?.id ?? 0) || null
      const isSosMode = sosPinId !== null
      if (isSosMode) {
        const pins = store.pins as unknown as Array<{ id: number }>
        const filtered = pins.filter((pin) => Number(pin.id) === sosPinId)
        store.pins = filtered as never
      }
      try {
        mapApi?.renderPins?.()
      } catch {}
    } finally {
      refreshing.value = false
    }
  }

  return { refreshing, refreshMap }
}
