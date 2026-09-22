import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { businessApi } from '@/services/business.api'
import { useBusinessStore } from '@/stores/business'
import type { BusinessAd } from '@/types/entities/Business'

/**
 * Реклама проверенной компании: новости и акции в кабинете.
 *
 * Писать может только верифицированный бизнес (бэк проверяет isVerified),
 * анти-спам — максимум 3 штуки за скользящие 7 дней (429 с подсказкой).
 * Удаление слот не возвращает: счётчик идёт по created_at.
 *
 * @returns список, квота, composer и действия
 * @example const ads = useBusinessAds()
 */
export function useBusinessAds() {
  const store = useBusinessStore()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  const ads = ref<BusinessAd[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const title = ref('')
  const body = ref('')
  const quota = ref<{ used: number; limit: number; left: number }>({ used: 0, limit: 3, left: 3 })

  const businessId = computed(() => Number(store.profile?.id ?? 0))
  const isVerified = computed(() => store.profile?.verification_status === 'verified')
  /** Можно ли открыть composer: проверен + есть слоты недели. */
  const canPublish = computed(() => isVerified.value && quota.value.left > 0 && !saving.value)
  const titleClean = computed(() => title.value.trim())
  const bodyClean = computed(() => body.value.trim())
  const canSubmit = computed(
    () => canPublish.value && titleClean.value.length >= 3 && bodyClean.value.length >= 3,
  )
  const quotaLabel = computed(() => `Осталось ${quota.value.left} из ${quota.value.limit} в неделю`)

  /**
   * Загрузить рекламу компании и квоту недели.
   */
  async function load(): Promise<void> {
    const id = businessId.value
    if (!(id > 0)) return
    loading.value = true
    try {
      const [rows, freshQuota] = await Promise.all([businessApi.listAds(id), businessApi.adsQuota()])
      ads.value = rows
      quota.value = freshQuota
    } catch {
      ads.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Опубликовать рекламу из composer.
   */
  async function publish(): Promise<void> {
    if (!canSubmit.value || saving.value) return
    saving.value = true
    try {
      const created = await businessApi.createAd(businessId.value, {
        title: titleClean.value.slice(0, 100),
        body: bodyClean.value.slice(0, 1000),
      })
      ads.value = [created, ...ads.value]
      title.value = ''
      body.value = ''
      quota.value = await businessApi.adsQuota().catch(() => quota.value)
      toast?.add({ severity: 'success', summary: 'Опубликовано', detail: quotaLabel.value, life: 3000 })
      await store.refreshDashboard().catch(() => {})
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast?.add({ severity: 'warn', summary: 'Не опубликовано', detail: message ?? 'Попробуйте позже', life: 4500 })
    } finally {
      saving.value = false
    }
  }

  /**
   * Удалить рекламу (слот недели не возвращается).
   *
   * @param id id рекламы
   */
  async function remove(id: number): Promise<void> {
    try {
      await businessApi.deleteAd(id)
      ads.value = ads.value.filter((ad) => Number(ad.id) !== Number(id))
      await store.refreshDashboard().catch(() => {})
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: message ?? 'Не получилось удалить', life: 3500 })
    }
  }

  onMounted(() => {
    void load()
  })

  return {
    ads,
    loading,
    saving,
    title,
    body,
    quota,
    isVerified,
    canPublish,
    canSubmit,
    quotaLabel,
    load,
    publish,
    remove,
  }
}
