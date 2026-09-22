import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { businessApi } from '@/services/business.api'
import { districtsApi } from '@/services/districts.api'
import { useBusinessStore } from '@/stores/business'
import type { BusinessAd } from '@/types/entities/Business'
import type { District } from '@/types/entities/District'

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
  /** Квота размещений рекламы в районах (3 в неделю). */
  const districtQuota = ref<{ used: number; limit: number; left: number }>({ used: 0, limit: 3, left: 3 })
  /** Районы организации (владелец + принятый участник) для предложения. */
  const myDistricts = ref<District[]>([])
  const districtsLoading = ref(false)
  /** Реклама, которую размещаем в районы (диалог предложения). */
  const placeAd = ref<BusinessAd | null>(null)
  const placeDistrictIds = ref<number[]>([])
  const placing = ref(false)

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
  const districtQuotaLabel = computed(() => `Районы: осталось ${districtQuota.value.left} из ${districtQuota.value.limit} в неделю`)

  /**
   * Загрузить рекламу компании и квоту недели.
   */
  async function load(): Promise<void> {
    const id = businessId.value
    if (!(id > 0)) return
    loading.value = true
    try {
      const [rows, freshQuota, freshDistrictQuota] = await Promise.all([
        businessApi.listAds(id),
        businessApi.adsQuota(),
        businessApi.districtQuota().catch(() => districtQuota.value),
      ])
      ads.value = rows
      quota.value = freshQuota
      districtQuota.value = freshDistrictQuota
    } catch {
      ads.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Подтянуть районы организации для предложения размещения.
   */
  async function ensureDistricts(): Promise<void> {
    if (districtsLoading.value || myDistricts.value.length > 0) return
    districtsLoading.value = true
    try {
      myDistricts.value = (await districtsApi.list(null, true)) ?? []
    } catch {
      myDistricts.value = []
    } finally {
      districtsLoading.value = false
    }
  }

  /**
   * Опубликовать рекламу из composer.
   *
   * Реклама сразу уходит новостью компании в UFlow (бэк), а здесь
   * предлагаем разместить её в районах организации — диалогом,
   * если есть районы-жители и слоты недели.
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
      districtQuota.value = await businessApi.districtQuota().catch(() => districtQuota.value)
      toast?.add({ severity: 'success', summary: 'Опубликовано', detail: 'Новость компании уже в UFlow', life: 3000 })
      await store.refreshDashboard().catch(() => {})
      await ensureDistricts()
      if (myDistricts.value.length > 0 && districtQuota.value.left > 0) {
        openPlaceDialog(created)
      }
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast?.add({ severity: 'warn', summary: 'Не опубликовано', detail: message ?? 'Попробуйте позже', life: 4500 })
    } finally {
      saving.value = false
    }
  }

  /**
   * Открыть предложение разместить рекламу в районах.
   * @param ad реклама кабинета
   */
  function openPlaceDialog(ad: BusinessAd): void {
    placeAd.value = ad
    placeDistrictIds.value = []
    void ensureDistricts()
  }

  /**
   * Закрыть диалог размещения.
   */
  function closePlaceDialog(): void {
    placeAd.value = null
    placeDistrictIds.value = []
  }

  /**
   * Разместить рекламу в выбранных районах (квота 3 в неделю).
   */
  async function placeInDistricts(): Promise<void> {
    const ad = placeAd.value
    if (!ad || placing.value || placeDistrictIds.value.length === 0) return
    placing.value = true
    try {
      const result = await businessApi.placeAdInDistricts(Number(ad.id), [...placeDistrictIds.value])
      districtQuota.value = result.quota
      const placedCount = result.placed.length
      if (placedCount > 0) {
        toast?.add({ severity: 'success', summary: `В районах: ${placedCount}`, detail: districtQuotaLabel.value, life: 3500 })
      }
      for (const skipped of result.skipped) {
        toast?.add({ severity: 'warn', summary: 'Не размещено', detail: String(skipped.reason ?? ''), life: 4000 })
      }
      closePlaceDialog()
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast?.add({ severity: 'warn', summary: 'Не размещено', detail: message ?? 'Попробуйте позже', life: 4500 })
    } finally {
      placing.value = false
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
    districtQuota,
    myDistricts,
    districtsLoading,
    placeAd,
    placeDistrictIds,
    placing,
    isVerified,
    canPublish,
    canSubmit,
    quotaLabel,
    districtQuotaLabel,
    load,
    publish,
    remove,
    ensureDistricts,
    openPlaceDialog,
    closePlaceDialog,
    placeInDistricts,
  }
}
