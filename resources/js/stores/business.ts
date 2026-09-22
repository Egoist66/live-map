import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { businessApi } from '@/services/business.api'
import type { BusinessDashboard, BusinessProfile, BusinessProfilePayload } from '@/types/entities/Business'

/**
 * Стор кабинета бизнеса: профиль РБ + дашборд заработка.
 *
 * Живое обновление верификации — через private `user.{id}` событие
 * `business.verified` (см. useBusinessProfile.bindRealtime).
 */
export const useBusinessStore = defineStore('business', () => {
  const profile = ref<BusinessProfile | null>(null)
  const dashboard = ref<BusinessDashboard | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const isVerified = computed(() => profile.value?.verification_status === 'verified')
  const isPending = computed(() => profile.value?.verification_status === 'pending')
  const stats = computed(() => dashboard.value?.stats ?? null)
  const earnHints = computed(() => dashboard.value?.earn ?? [])

  /**
   * Загрузить профиль и дашборд параллельно.
   */
  async function loadAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [freshProfile, freshDashboard] = await Promise.all([businessApi.getProfile(), businessApi.getDashboard()])
      profile.value = freshProfile
      dashboard.value = freshDashboard
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      error.value = message ?? 'Не удалось загрузить кабинет'
    } finally {
      loading.value = false
    }
  }

  /**
   * Обновить дашборд (цифры после создания пина).
   */
  async function refreshDashboard(): Promise<void> {
    try {
      dashboard.value = await businessApi.getDashboard()
      if (dashboard.value?.business) {
        profile.value = dashboard.value.business
      }
    } catch {}
  }

  /**
   * Сохранить профиль РБ.
   * @param payload поля профиля
   * @returns true если сохранено
   */
  async function save(payload: BusinessProfilePayload): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      profile.value = await businessApi.updateProfile(payload)
      await refreshDashboard()
      return true
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      error.value = message ?? 'Не получилось сохранить'
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Отправить на проверку по УНП.
   * @returns true если принято в pending
   */
  async function submit(): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      profile.value = await businessApi.submitForVerification()
      await refreshDashboard()
      return true
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      error.value = message ?? 'Заполните УНП и юрадрес'
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Применить верификацию из realtime-события.
   * @param next свежий профиль из broadcast
   */
  function applyRealtime(next: BusinessProfile): void {
    profile.value = next
    if (dashboard.value) {
      dashboard.value.business = next
    }
  }

  return {
    profile,
    dashboard,
    loading,
    saving,
    error,
    isVerified,
    isPending,
    stats,
    earnHints,
    loadAll,
    refreshDashboard,
    save,
    submit,
    applyRealtime,
  }
})
