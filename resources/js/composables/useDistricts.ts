import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { districtsApi } from '@/services/districts.api'
import { busOn } from '@/services/realtime-bus'
import { useDistrictsStore } from '@/stores/districts'
import { useDistrictJoinRequest } from '@/composables/useDistrictJoinRequest'
import { useViewportBreakpoints } from '@/composables/useViewportBreakpoints'
import type { CreateDistrictPayload, DistrictDetails, DistrictResident } from '@/types/entities/District'

/**
 * UDistrict-данные для карты: выбор, детали, заявки, жители.
 *
 * Слой и кисть живут в useMap/useDistrictPaint, серверное
 * состояние — в districts-сторе, здесь — сценарии диалогов.
 */
export function useDistricts() {
  const store = useDistrictsStore()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as any
    }
  })()

  /** Витрина районов (хаб UDistrict): список + вход в рисование. */
  const hubOpen = ref(false)
  /** Слой заливок виден на карте. */
  const districtsVisible = ref(readVisible())
  /** Выбранный район: детали для карточки. */
  const selected = ref<DistrictDetails | null>(null)
  /** Карточка деталей открыта. */
  const detailsOpen = ref(false)
  /** Диалог создания из черновика кисти. */
  const createOpen = ref(false)
  const detailsLoading = ref(false)
  /** Жители и заявки выбранного района. */
  const residents = ref<DistrictResident[]>([])
  const pending = ref<DistrictResident[]>([])
  /** Исходящие приглашения владельца (ждут ответа). */
  const invited = ref<DistrictResident[]>([])
  /** Свои районы для хаба. */
  const myDistricts = ref<Awaited<ReturnType<typeof districtsApi.list>>>([])
  const myLoading = ref(false)
  /** Заявка в район: организациям — модалка цели вступления. */
  const joinRequest = useDistrictJoinRequest()

  /** Мобильный вьюпорт: создание районов кистью недоступно, только список + заявка. */
  const { isMobile } = useViewportBreakpoints()
  /** Создание районов разрешено только на десктопе. */
  const canCreate = computed(() => !isMobile.value)

  const isOwner = computed(() => selected.value?.role === 'owner')
  const canSeeInside = computed(() => selected.value && (selected.value.role === 'owner' || selected.value.role === 'member'))

  function readVisible(): boolean {
    try {
      return localStorage.getItem('upin.districts.visible') !== '0'
    } catch {
      return true
    }
  }

  /**
   * Переключить слой заливок на карте.
   */
  function toggleVisible(): void {
    setVisible(!districtsVisible.value)
  }

  /**
   * Включить/выключить слой заливок.
   *
   * @param v виден ли слой
   */
  function setVisible(v: boolean): void {
    districtsVisible.value = v
    try {
      localStorage.setItem('upin.districts.visible', v ? '1' : '0')
    } catch {}
  }

  function fail(e: any, fallback: string): void {
    toast?.add({ severity: 'error', summary: 'Районы', detail: e?.response?.data?.message ?? fallback, life: 3500 })
  }

  /**
   * Открыть карточку района.
   *
   * @param id id района
   */
  async function openDistrict(id: number): Promise<void> {
    detailsLoading.value = true
    try {
      selected.value = await districtsApi.show(id)
      residents.value = []
      pending.value = []
      invited.value = []
      detailsOpen.value = true
      await loadMembers(id)
    } catch (e: any) {
      fail(e, 'Не удалось открыть район')
    } finally {
      detailsLoading.value = false
    }
  }

  /**
   * Закрыть карточку района.
   */
  function closeDistrict(): void {
    detailsOpen.value = false
    selected.value = null
    residents.value = []
    pending.value = []
    invited.value = []
  }

  /**
   * Подтянуть жителей, заявки и приглашения выбранного района.
   *
   * @param id id района
   */
  async function loadMembers(id: number): Promise<void> {
    try {
      const data = await districtsApi.members(id)
      residents.value = data.residents ?? []
      pending.value = data.pending ?? []
      invited.value = data.invited ?? []
      if (selected.value && data.role) {
        selected.value.role = data.role as DistrictDetails['role']
      }
    } catch {}
  }

  /**
   * Обновить детали выбранного района (после заявок/решений).
   */
  async function refreshSelected(): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      selected.value = await districtsApi.show(selected.value.id)
      await loadMembers(selected.value.id)
    } catch {}
  }

  /**
   * Кинуть заявку в выбранный район.
   *
   * Организации — через модалку цели вступления, персоны — в один клик
   * (общая логика useDistrictJoinRequest).
   */
  async function joinSelected(): Promise<void> {
    if (!selected.value) {
      return
    }
    await joinRequest.request(selected.value.id, String(selected.value.name ?? ''), async () => {
      await refreshSelected()
      syncLayerCard()
    })
  }

  /**
   * Выйти из района / отозвать заявку.
   */
  async function leaveSelected(): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      await districtsApi.leave(selected.value.id)
      toast?.add({ severity: 'success', summary: 'Вы вышли из района', life: 2500 })
      await refreshSelected()
      syncLayerCard()
    } catch (e: any) {
      fail(e, 'Не удалось выйти')
    }
  }

  /**
   * Принять приглашение в выбранный район (только приглашённый).
   *
   * Открывает пины района и общий чат.
   */
  async function acceptInvite(): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      await districtsApi.acceptInvite(selected.value.id)
      toast?.add({ severity: 'success', summary: 'Вы в районе', detail: 'Пины района и общий чат открыты', life: 3000 })
      await refreshSelected()
      syncLayerCard()
    } catch (e: any) {
      fail(e, 'Не удалось принять приглашение')
    }
  }

  /**
   * Отклонить приглашение в выбранный район (тихо, владельца не спамим).
   */
  async function declineInvite(): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      await districtsApi.declineInvite(selected.value.id)
      toast?.add({ severity: 'success', summary: 'Приглашение отклонено', life: 2500 })
      await refreshSelected()
      syncLayerCard()
    } catch (e: any) {
      fail(e, 'Не удалось отклонить приглашение')
    }
  }

  /**
   * Отозвать исходящее приглашение (владелец).
   *
   * @param userId кого отменяем
   */
  async function cancelInvite(userId: number): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      await districtsApi.cancelInvite(selected.value.id, userId)
      await refreshSelected()
    } catch (e: any) {
      fail(e, 'Не удалось отозвать приглашение')
    }
  }

  /**
   * Одобрить заявку (владелец).
   *
   * @param userId автор заявки
   */
  async function approveMember(userId: number): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      await districtsApi.approve(selected.value.id, userId)
      toast?.add({ severity: 'success', summary: 'Житель принят', detail: 'Открыт доступ к пинам и чату района', life: 3000 })
      await refreshSelected()
      syncLayerCard()
    } catch (e: any) {
      fail(e, 'Не удалось одобрить')
    }
  }

  /**
   * Отклонить заявку (владелец).
   *
   * @param userId автор заявки
   */
  async function rejectMember(userId: number): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      await districtsApi.reject(selected.value.id, userId)
      await loadMembers(selected.value.id)
    } catch (e: any) {
      fail(e, 'Не удалось отклонить')
    }
  }

  /**
   * Исключить жителя (владелец).
   *
   * @param userId житель
   */
  async function kickMember(userId: number): Promise<void> {
    if (!selected.value) {
      return
    }
    try {
      await districtsApi.kick(selected.value.id, userId)
      await refreshSelected()
      syncLayerCard()
    } catch (e: any) {
      fail(e, 'Не удалось исключить')
    }
  }

  /**
   * Удалить свой район вместе с чатом.
   */
  async function deleteSelected(): Promise<boolean> {
    if (!selected.value) {
      return false
    }
    const id = selected.value.id
    try {
      await districtsApi.remove(id)
      store.removeRealtime(id)
      closeDistrict()
      toast?.add({ severity: 'success', summary: 'Район удалён', life: 2500 })
      return true
    } catch (e: any) {
      fail(e, 'Не удалось удалить район')
      return false
    }
  }

  /**
   * Сохранить правки названия/описания/интереса.
   *
   * @param payload поля формы
   */
  async function saveSelected(payload: Partial<CreateDistrictPayload>): Promise<boolean> {
    if (!selected.value) {
      return false
    }
    try {
      const updated = await districtsApi.update(selected.value.id, payload)
      selected.value = updated
      store.upsertRealtime(updated)
      toast?.add({ severity: 'success', summary: 'Район обновлён', life: 2500 })
      return true
    } catch (e: any) {
      fail(e, 'Не удалось сохранить')
      return false
    }
  }

  /**
   * Свои районы для хаба UDistrict.
   */
  async function loadMine(): Promise<void> {
    myLoading.value = true
    try {
      myDistricts.value = await districtsApi.list(null, true)
    } catch {
      myDistricts.value = []
    } finally {
      myLoading.value = false
    }
  }

  /**
   * Открыть хаб UDistrict (список + рисование на десктопе, только список на мобиле).
   */
  function openHub(): void {
    hubOpen.value = true
    if (!isMobile.value) {
      void loadMine()
    }
  }

  /**
   * Сеттер хаба для шаблонов (прямое присваивание затрёт ref).
   *
   * @param v открыт ли хаб
   */
  function setHubOpen(v: boolean): void {
    hubOpen.value = v
    if (v && !isMobile.value) {
      void loadMine()
    }
  }

  /**
   * Сеттер диалога создания для шаблонов.
   *
   * @param v открыт ли диалог
   */
  function setCreateOpen(v: boolean): void {
    createOpen.value = v
  }

  /**
   * Сеттер карточки деталей для шаблонов.
   *
   * @param v открыта ли карточка
   */
  function setDetailsOpen(v: boolean): void {
    if (!v) {
      closeDistrict()
      return
    }
    detailsOpen.value = true
  }

  /**
   * Синхронизировать карточку слоя после смены состава.
   */
  function syncLayerCard(): void {
    if (selected.value) {
      store.upsertRealtime(selected.value)
    }
  }

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Живая карточка: сокет/шина обновляют детали и заявки,
   * в polling-режиме — мягкий рефреш. Удаление закрывает карточку.
   */
  const stopBusChanged = busOn('map:district-changed', (payload) => {
    if (detailsOpen.value && selected.value && Number(payload?.id) === Number(selected.value.id)) {
      void refreshSelected()
    }
  })
  const stopBusDeleted = busOn('map:district-deleted', (payload) => {
    if (selected.value && Number(payload?.id) === Number(selected.value.id)) {
      closeDistrict()
    }
  })

  watch(detailsOpen, (open) => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    if (open && selected.value) {
      refreshTimer = setInterval(() => {
        if (detailsOpen.value && selected.value && !document.hidden) {
          void refreshSelected()
        }
      }, 20000)
    }
  })

  onBeforeUnmount(() => {
    try { stopBusChanged() } catch {}
    try { stopBusDeleted() } catch {}
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  })

  return {
    store,
    hubOpen,
    districtsVisible,
    selected,
    detailsOpen,
    createOpen,
    detailsLoading,
    residents,
    pending,
    invited,
    myDistricts,
    myLoading,
    isMobile,
    canCreate,
    isOwner,
    canSeeInside,
    toggleVisible,
    setVisible,
    openHub,
    setHubOpen,
    setCreateOpen,
    setDetailsOpen,
    loadMine,
    openDistrict,
    closeDistrict,
    loadMembers,
    refreshSelected,
    joinSelected,
    joinRequest,
    leaveSelected,
    acceptInvite,
    declineInvite,
    cancelInvite,
    approveMember,
    rejectMember,
    kickMember,
    deleteSelected,
    saveSelected,
  }
}
