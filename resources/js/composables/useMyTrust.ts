import { computed, ref } from 'vue'
import { trustApi, type TrustState } from '@/services/trust.api'

/**
 * Своя репутация для настроек профиля: траст-скор 1–10 и его зона.
 *
 * Скор считает бэк: жалобы, блоки и низкие оценки роняют,
 * PRO/Premium возвращает 10. Компонент только отображает.
 *
 * @returns скор, зона, загрузка и перезагрузка
 * @example const trust = useMyTrust()
 */
export function useMyTrust() {
  const state = ref<TrustState | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const score = computed(() => state.value?.score ?? null)
  const label = computed(() => state.value?.label ?? '')
  const hint = computed(() => state.value?.hint ?? '')

  /**
   * Загрузить свою репутацию с сервера.
   */
  async function load(): Promise<void> {
    if (loading.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      state.value = await trustApi.me()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не получилось загрузить репутацию'
    } finally {
      loading.value = false
    }
  }

  void load()

  return { score, label, hint, loading, error, reload: load }
}
