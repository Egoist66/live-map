import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { profileStatsApi, type ProfileStatsSummary } from '@/services/profileStats.api'

/**
 * Статистика профиля для вкладки «Приложение → Статистика».
 *
 * Free видит базу (время в приложении, лайки неделя/месяц,
 * просмотры, мэтчи). Pro — плюс аудиторию (интересы,
 * возраст, пол лайкнувших). Premium — плюс конкретных
 * гостей страницы с анкетой и кнопкой «написать».
 *
 * @returns состояние сводки, загрузка и выгрузка CSV
 * @example
 * const stats = useProfileStats()
 * onMounted(() => stats.load())
 */
export function useProfileStats() {
  const toast = useToast()

  const state = ref({
    summary: null as ProfileStatsSummary | null,
    loading: false,
    exporting: false,
    error: null as string | null,
  })

  const summary = computed(() => state.value.summary)
  const loading = computed(() => state.value.loading)
  const tier = computed(() => state.value.summary?.tier ?? 'free')
  const isPro = computed(() => tier.value === 'pro' || tier.value === 'premium')
  const isPremium = computed(() => tier.value === 'premium')

  /**
   * Загрузить сводку статистики с бэка.
   */
  async function load(): Promise<void> {
    state.value.loading = true
    state.value.error = null

    try {
      state.value.summary = await profileStatsApi.summary()
    } catch {
      state.value.error = 'Не получилось загрузить статистику — попробуйте позже'
    } finally {
      state.value.loading = false
    }
  }

  /**
   * Скачать выгрузку CSV (состав файла — по тарифу).
   */
  async function exportCsv(): Promise<void> {
    state.value.exporting = true

    try {
      const link = document.createElement('a')
      link.href = profileStatsApi.exportUrl()
      link.download = ''
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.add({ severity: 'success', summary: 'Выгрузка началась', detail: 'CSV со статистикой уже летит', life: 3000 })
    } finally {
      state.value.exporting = false
    }
  }

  /**
   * Записать просмотр чужого профиля (дедуп раз в сутки на бэке).
   *
   * @param userId id просматриваемого профиля
   */
  async function trackView(userId: number): Promise<void> {
    if (!Number.isFinite(userId) || userId <= 0) {
      return
    }

    try {
      await profileStatsApi.trackView(userId)
    } catch {
      /* статистика не должна мешать просмотру */
    }
  }

  return { state, summary, loading, tier, isPro, isPremium, load, exportCsv, trackView }
}
