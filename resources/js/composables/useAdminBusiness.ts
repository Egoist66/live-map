import { computed, onBeforeUnmount, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { businessApi } from '@/services/business.api'
import { busOn, busEmit } from '@/services/realtime-bus'
import { pokeRealtime } from '@/composables/useRealtimePoller'
import type { BusinessProfile } from '@/types/entities/Business'

/**
 * Очередь заявок бизнеса для модерации (админы + модераторы).
 *
 * Заявки прилетают тремя путями (правило №10, №13):
 * socket `.business.verification.submitted`, polling `business:pending`
 * из RealtimeController::sync и inbox-тост useAppNotifications.
 * Список обновляется реактивно без перезагрузки страницы.
 *
 * @returns очередь, фильтры и действия verify/reject
 * @example const queue = useAdminBusiness(); queue.init()
 */
export function useAdminBusiness() {
  const toast = useToast()
  const items = ref<BusinessProfile[]>([])
  const loading = ref(false)
  const actingId = ref<number | null>(null)
  const status = ref<'pending' | 'verified' | 'rejected' | 'draft' | 'all'>('pending')
  const query = ref('')
  const page = ref(1)
  const total = ref(0)
  const lastPage = ref(1)
  const pendingCount = ref(0)
  const rejectTarget = ref<BusinessProfile | null>(null)
  const rejectReason = ref('')

  let unsubs: Array<() => void> = []
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  const pendingBadge = computed(() => pendingCount.value)

  /**
   * Загрузить очередь с текущими фильтрами.
   */
  async function load(): Promise<void> {
    loading.value = true
    try {
      const res = await businessApi.adminQueue(status.value, query.value.trim(), page.value)
      items.value = Array.isArray(res?.data) ? res.data : []
      total.value = Number(res?.total ?? items.value.length)
      lastPage.value = Number(res?.last_page ?? 1)
      pendingCount.value = Number(res?.pending_count ?? 0)
    } catch {
      items.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Поиск с дебаунсом (не дёргаем API на каждую букву).
   * @param value строка поиска
   */
  function setQuery(value: string): void {
    query.value = value
    page.value = 1
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => void load(), 400)
  }

  /**
   * Сменить фильтр статуса.
   * @param next новый статус
   */
  function setStatus(next: typeof status.value): void {
    status.value = next
    page.value = 1
    void load()
  }

  /**
   * Одобрить заявку: бейдж «Проверено», разблокировка пинов.
   * @param business заявка из очереди
   */
  async function verify(business: BusinessProfile): Promise<void> {
    if (actingId.value !== null) return
    actingId.value = business.id
    try {
      await businessApi.adminVerify(business.id)
      toast.add({ severity: 'success', summary: 'Одобрено', detail: `${business.name} — бейдж «Проверено» включён`, life: 3500 })
      try { pokeRealtime() } catch {}
      await load()
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.add({ severity: 'error', summary: 'Ошибка', detail: message ?? 'Не получилось одобрить', life: 4000 })
    } finally {
      actingId.value = null
    }
  }

  /**
   * Открыть диалог отказа с причиной.
   * @param business заявка из очереди
   */
  function askReject(business: BusinessProfile): void {
    rejectTarget.value = business
    rejectReason.value = ''
  }

  /**
   * Подтвердить отказ с причиной (минимум 3 символа).
   */
  async function confirmReject(): Promise<void> {
    const target = rejectTarget.value
    const reason = rejectReason.value.trim()
    if (!target || reason.length < 3 || actingId.value !== null) return
    actingId.value = target.id
    try {
      await businessApi.adminReject(target.id, reason)
      toast.add({ severity: 'success', summary: 'Отклонено', detail: `${target.name} — владелец увидит причину`, life: 3500 })
      rejectTarget.value = null
      rejectReason.value = ''
      try { pokeRealtime() } catch {}
      await load()
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.add({ severity: 'error', summary: 'Ошибка', detail: message ?? 'Не получилось отклонить', life: 4000 })
    } finally {
      actingId.value = null
    }
  }

  function closeReject(): void {
    rejectTarget.value = null
    rejectReason.value = ''
  }

  /**
   * Новая заявка из realtime: вставить наверх pending-списка.
   * @param business заявка из broadcast/polling
   * @param bump поднять ли счётчик (false когда счётчик уже пришёл в событии)
   */
  function upsertIncoming(business: BusinessProfile, bump = true): void {
    if (bump) pendingCount.value += 1
    if (status.value !== 'pending' && status.value !== 'all') return
    if (query.value.trim() !== '') {
      void load()
      return
    }
    const exists = items.value.some((row) => Number(row.id) === Number(business.id))
    if (!exists) {
      items.value = [business, ...items.value].slice(0, 20)
      total.value += 1
    } else {
      items.value = items.value.map((row) => (Number(row.id) === Number(business.id) ? business : row))
    }
  }

  /**
   * Подписаться на realtime очереди (socket + polling).
   */
  function init(): void {
    void load()
    if (unsubs.length) return
    unsubs = [
      busOn('user:business.verification.submitted', (e) => {
        if (e?.business) upsertIncoming(e.business as BusinessProfile)
      }),
      busOn('business:pending', (e) => {
        if (typeof e?.count === 'number') pendingCount.value = e.count
        const fresh = Array.isArray(e?.items) ? e.items : []
        for (const row of fresh) {
          if (row) upsertIncoming(row as BusinessProfile, false)
        }
      }),
      busOn('badges:update', (badges) => {
        const count = (badges as Record<string, number>)?.business_pending
        if (typeof count === 'number') pendingCount.value = count
      }),
    ]
    try { busEmit('badges:request', Date.now()) } catch {}
  }

  onBeforeUnmount(() => {
    for (const off of unsubs) {
      try { off() } catch {}
    }
    unsubs = []
    if (searchTimer) clearTimeout(searchTimer)
  })

  return {
    items,
    loading,
    actingId,
    status,
    query,
    page,
    total,
    lastPage,
    pendingCount,
    pendingBadge,
    rejectTarget,
    rejectReason,
    load,
    setQuery,
    setStatus,
    setPage: (next: number) => { page.value = next; void load() },
    verify,
    askReject,
    confirmReject,
    closeReject,
    init,
  }
}
