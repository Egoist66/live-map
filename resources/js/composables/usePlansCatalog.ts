import { shallowRef } from 'vue'
import { subscriptionApi, type PlansCatalog } from '@/services/subscription.api'

/**
 * Запасные подписи на случай, если бэкенд недоступен (только офлайн-страховка).
 * При нормальной работе цены всегда приходят с бэкенда — он собирает их
 * из настроек по умолчанию плюс правки из админки.
 */
const FALLBACK_PRICES: Record<string, string> = {
  free: 'Бесплатно',
  pro: '$3.99 / мес',
  premium: '$7.99 / мес',
  business: '$19.99 / мес',
}

const catalog = shallowRef<PlansCatalog | null>(null)
let loadStarted = false

async function ensureLoaded(): Promise<void> {
  if (loadStarted) return
  loadStarted = true

  try {
    catalog.value = await subscriptionApi.plans()
  } catch {
    catalog.value = null
  }
}

void ensureLoaded()

/**
 * Каталог тарифов с бэкенда (динамический: настройки + правки из админки).
 *
 * Фронт не придумывает цены и списки «что входит» сам: всё берётся из каталога
 * своей аудитории, при недоступности API — запасные значения. Загрузка одна
 * на приложение (модульный синглтон).
 *
 * @returns каталог, позиции витрины и подпись цены тарифа
 * @example const { priceFor } = usePlansCatalog(); priceFor('pro') // '$3.99 / мес'
 */
export function usePlansCatalog() {
  /**
   * Подпись цены тарифа для карточек и окон.
   * @param id идентификатор тарифа
   */
  function priceFor(id: string): string {
    const found = catalog.value?.plans.find((p) => p.id === id)
    return found?.price ?? FALLBACK_PRICES[id] ?? ''
  }

  /**
   * Возможности тарифа («что входит») с бэкенда.
   *
   * Страховка от не-массива: кривой `features` (объект вместо списка)
   * ронял модалку тарифа на `.map` — отдаём пусто, модалка жива.
   * @param id идентификатор тарифа
   */
  function featuresFor(id: string): { key: string; name: string; description: string | null }[] {
    const list = catalog.value?.plans.find((p) => p.id === id)?.features
    return Array.isArray(list) ? list : []
  }

  /**
   * Принудительно обновить каталог (например, после правок цен в админке).
   */
  async function refresh(): Promise<void> {
    loadStarted = false
    catalog.value = null
    await ensureLoaded()
  }

  return { catalog, priceFor, featuresFor, refresh }
}
