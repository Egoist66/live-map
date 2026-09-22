import { computed, onMounted } from 'vue'
import { useBusinessStore } from '@/stores/business'

/**
 * Фасад дашборда кабинета: цифры, пины, earn-подсказки.
 *
 * Тонкий слой над Pinia-стором для страниц (правило №1, №8).
 *
 * @returns стор, вычисляемые ряды и загрузку
 * @example const dash = useBusinessDashboard()
 */
export function useBusinessDashboard() {
  const store = useBusinessStore()

  const cards = computed(() => {
    const stats = store.stats
    if (!stats) {
      return []
    }
    return [
      { key: 'views_week', label: 'Просмотры · 7 дней', value: stats.views_week, icon: 'pi pi-eye' },
      { key: 'views_total', label: 'Просмотры всего', value: stats.views_total, icon: 'pi pi-chart-line' },
      { key: 'pins_live', label: 'Активных пинов', value: stats.pins_live, icon: 'pi pi-map-marker' },
      { key: 'likes_total', label: 'Лайков', value: stats.likes_total, icon: 'pi pi-heart' },
    ]
  })

  const needsVerification = computed(() => store.profile?.verification_status !== 'verified')
  const recentPins = computed(() => store.dashboard?.recent_pins ?? [])

  /**
   * Шаги проверки для hero кабинета: реквизиты → проверка → проверено.
   */
  const verificationSteps = computed(() => {
    const status = store.profile?.verification_status ?? 'draft'
    const hasDetails =
      String(store.profile?.name ?? '').trim().length >= 2 &&
      /^\d{9}$/.test(String(store.profile?.unp ?? '')) &&
      String(store.profile?.legal_address ?? '').trim().length > 3

    if (status === 'verified') {
      return [
        { label: 'Реквизиты', state: 'done' },
        { label: 'Проверка', state: 'done' },
        { label: 'Проверено', state: 'done' },
      ]
    }
    if (status === 'pending') {
      return [
        { label: 'Реквизиты', state: 'done' },
        { label: 'Проверка', state: 'active' },
        { label: 'Проверено', state: 'todo' },
      ]
    }
    return [
      { label: 'Реквизиты', state: hasDetails ? 'done' : 'active' },
      { label: 'Проверка', state: 'todo' },
      { label: 'Проверено', state: 'todo' },
    ]
  })

  async function load(): Promise<void> {
    if (!store.dashboard && !store.loading) {
      await store.loadAll()
    }
  }

  async function refresh(): Promise<void> {
    await store.refreshDashboard()
  }

  onMounted(() => {
    void load()
  })

  return { store, cards, needsVerification, recentPins, verificationSteps, load, refresh }
}
