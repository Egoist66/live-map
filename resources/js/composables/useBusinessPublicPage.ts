import { onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { chatApi } from '@/services/chat.api'
import { businessApi } from '@/services/business.api'
import type { BusinessAd } from '@/types/entities/Business'

/**
 * Публичная страница компании: написать владельцу в чат + реклама.
 *
 * @param ownerId id владельца компании
 * @param businessId id компании для витрины рекламы
 * @param initialAds SSR-список рекламы (без мигания)
 * @returns флаг отправки, действие чата и рекламу витрины
 * @example const { writing, writeToCompany, ads } = useBusinessPublicPage(owner.id, business.id, initialAds)
 */
export function useBusinessPublicPage(ownerId: number, businessId = 0, initialAds: BusinessAd[] = []) {
  const writing = ref(false)
  /** Реклама компании для витрины (видят все). */
  const ads = ref<BusinessAd[]>(Array.isArray(initialAds) ? initialAds : [])
  const adsLoading = ref(false)

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  /**
   * Открыть диалог с компанией (создать при отсутствии).
   */
  async function writeToCompany(): Promise<void> {
    if (writing.value) {
      return
    }
    writing.value = true
    try {
      const conversation = (await chatApi.createConversation(ownerId)) as { id?: number; conversation?: { id?: number } }
      const conversationId = conversation?.id ?? conversation?.conversation?.id
      router.visit(conversationId ? `/chat/${conversationId}` : '/chat')
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast?.add({ severity: 'warn', summary: 'Не получилось написать', detail: message ?? 'Попробуйте позже', life: 4000 })
    } finally {
      writing.value = false
    }
  }

  /**
   * Освежить витрину рекламы (после SSR — свежие сверху).
   */
  async function loadAds(): Promise<void> {
    if (!(businessId > 0)) return
    adsLoading.value = true
    try {
      ads.value = await businessApi.listAds(businessId)
    } catch {
    } finally {
      adsLoading.value = false
    }
  }

  onMounted(() => {
    void loadAds()
  })

  return { writing, writeToCompany, ads, adsLoading, loadAds }
}
