import { defineStore } from 'pinia'
import { ref } from 'vue'
import { businessApi } from '@/services/business.api'
import type { BusinessMapItem } from '@/types/entities/Business'
import type { Pin } from '@/types/entities/Pin'

/**
 * Провайдер перехода к пину компании из модалки.
 *
 * Регистрируется map-слоем (useBusinessMarkers): долететь на карте
 * и открыть карточку пина. До привязки слоя переход — no-op.
 */
interface BusinessPinJumpHooks {
  jumpToPin(pin: Pin): void
}

/**
 * Стор бизнес-маркеров на карте: состояние модалки компании.
 *
 * Хранит список компаний в зоне видимости и данные открытой модалки.
 * Тяжелая map-логика (слой маркеров, fetch по moveend) живёт в
 * ленивом чанке useBusinessMarkers — стор тут только state/action,
 * чтобы модалка не тянула maplibre и бизнес-слой в главный код.
 */
export const useBusinessMarkersStore = defineStore('businessMarkers', () => {
  const companies = ref<BusinessMapItem[]>([])
  const modalVisible = ref(false)
  const opened = ref<BusinessMapItem | null>(null)
  const companyPins = ref<Pin[]>([])
  const pinsLoading = ref(false)
  const pinsError = ref<string | null>(null)

  let pinJump: BusinessPinJumpHooks | null = null

  /**
   * Открыть модалку компании и загрузить её пины.
   *
   * @param id id компании
   * @returns void
   */
  async function openCompany(id: number): Promise<void> {
    const company = companies.value.find((item) => Number(item.id) === Number(id)) ?? null
    if (!company) {
      return
    }
    opened.value = company
    companyPins.value = []
    pinsError.value = null
    modalVisible.value = true
    pinsLoading.value = true
    try {
      companyPins.value = await businessApi.companyPins(company.id)
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      pinsError.value = message ?? 'Не удалось загрузить пины компании'
    } finally {
      pinsLoading.value = false
    }
  }

  /**
   * Закрыть модалку компании и сбросить её данные.
   */
  function closeCompany(): void {
    modalVisible.value = false
    opened.value = null
    companyPins.value = []
    pinsError.value = null
  }

  /**
   * Зарегистрировать обработчик перехода к пину (вызывает map-слой).
   *
   * @param hooks хуки долёта к пину или null для отвязки
   */
  function registerPinJumpHooks(hooks: BusinessPinJumpHooks | null): void {
    pinJump = hooks
  }

  /**
   * Клик по пину компании в модалке: закрыть модалку и долететь к пину.
   *
   * @param pin пин из списка компании
   */
  function openCompanyPin(pin: Pin): void {
    modalVisible.value = false
    try {
      pinJump?.jumpToPin(pin)
    } catch {}
  }

  /**
   * Сбросить список компаний и модалку (при откреплении map-слоя).
   */
  function reset(): void {
    companies.value = []
    closeCompany()
  }

  return {
    companies,
    modalVisible,
    opened,
    companyPins,
    pinsLoading,
    pinsError,
    openCompany,
    closeCompany,
    registerPinJumpHooks,
    openCompanyPin,
    reset,
  }
})
