import { shallowRef } from 'vue'
import { subscriptionApi, type PlansCatalog } from '@/services/subscription.api'

/**
 * Запасные подписи цен, если каталог с бэка недоступен.
 * Совпадают с config/plans.php — при смене цен править оба места.
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
 * Каталог тарифов с бэка (цены — из config/plans.php).
 *
 * Фронт не хардкодит цены: подпись берётся из каталога своей аудитории
 * (персоны — free/pro/premium, организации — free/business), при недоступности
 * API — запасные значения. Загрузка одна на приложение (модульный синглтон).
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
   * Принудительно обновить каталог (например, после смены региона цен).
   */
  async function refresh(): Promise<void> {
    loadStarted = false
    catalog.value = null
    await ensureLoaded()
  }

  return { catalog, priceFor, refresh }
}
