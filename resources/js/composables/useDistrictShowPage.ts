import { computed, onBeforeUnmount, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { districtsApi } from '@/services/districts.api'
import { chatApi } from '@/services/chat.api'
import { busOn } from '@/services/realtime-bus'
import { useDistrictsStore } from '@/stores/districts'
import { useDistrictInvite } from '@/composables/useDistrictInvite'
import { useDistrictCover } from '@/composables/useDistrictCover'
import { useAppConfirm } from '@/composables/useAppConfirm'
import { districtInterestLabel } from '@/utils/districtGeo'
import type { DistrictDetails, DistrictResident } from '@/types/entities/District'
import { isUnchangedPayload } from '@/composables/useUnchangedGuard'

/**
 * Страница района: данные, табы, заявки, живой рефреш.
 *
 * Вся логика страницы — здесь. Компонент Districts/Show только
 * читает refs и вешает presentational-блоки на события хука.
 *
 * @param districtId id района из SSR-пропсов
 * @param initialDistrict SSR-карточка (без мигания лоадера)
 * @example
 * const page = useDistrictShowPage(props.districtId, props.initialDistrict)
 * await page.init()
 */
export function useDistrictShowPage(districtId: number, initialDistrict: DistrictDetails | null) {
  const store = useDistrictsStore()
  const invite = useDistrictInvite()
  const { confirmDelete } = useAppConfirm()

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  /** Полная карточка района. */
  const district = ref<DistrictDetails | null>(initialDistrict)
  /** Жители, заявки, приглашения. */
  const residents = ref<DistrictResident[]>([])
  const pending = ref<DistrictResident[]>([])
  const invited = ref<DistrictResident[]>([])
  /** Загрузка деталей / участников. */
  const loading = ref(!initialDistrict)
  const membersLoading = ref(false)
  /** Активный таб: лента, участники, информация, заявки. */
  const activeTab = ref<'feed' | 'members' | 'info' | 'requests'>('feed')
  /** Черновик правок владельца. */
  const editing = ref(false)
  const editName = ref('')
  const editDescription = ref('')
  const editInterest = ref('neighbors')
  const saving = ref(false)
  /** Открываем личку с владельцем. */
  const writingOwner = ref(false)

  const isOwner = computed(() => district.value?.role === 'owner')
  const isMember = computed(() => district.value?.role === 'member')
  const isGuest = computed(() => district.value?.role === 'guest')
  const isPending = computed(() => district.value?.role === 'pending')
  const isInvited = computed(() => district.value?.role === 'invited')
  const canChat = computed(() => {
    const role = district.value?.role
    const chatId = Number(district.value?.conversation_id)
    const isResident = role === 'owner' || role === 'member'
    return isResident && chatId > 0
  })
  const requestsCount = computed(() => pending.value.length + invited.value.length)
  const avatarLetter = computed(() => {
    const name = String(district.value?.name ?? '?').trim()
    return name.slice(0, 1).toUpperCase() || '?'
  })
  const interestLabel = computed(() => districtInterestLabel(district.value?.interest))
  const typeLine = computed(() => {
    const interest = interestLabel.value
    return `Открытое сообщество · ${interest}`
  })
  const roleLabel = computed(() => {
    if (isOwner.value) {
      return 'ваш район'
    }
    if (isMember.value) {
      return 'вы житель'
    }
    if (isPending.value) {
      return 'заявка отправлена'
    }
    if (isInvited.value) {
      return 'вас пригласили'
    }
    return null
  })
  const roleTone = computed(() => {
    if (isOwner.value) {
      return 'owner' as const
    }
    if (isMember.value) {
      return 'member' as const
    }
    if (isPending.value) {
      return 'pending' as const
    }
    if (isInvited.value) {
      return 'invited' as const
    }
    return null
  })

  const coverUrl = computed(() => district.value?.cover_url ?? null)
  const cover = useDistrictCover(district, isOwner)

  /**
   * Показать ошибку тостом.
   *
   * @param error ответ API
   * @param fallback запасной текст
   */
  function fail(error: unknown, fallback: string): void {
    const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
    toast?.add({ severity: 'error', summary: 'Район', detail, life: 3500 })
  }

  /**
   * Загрузить карточку района.
   */
  async function loadDistrict(): Promise<void> {
    loading.value = true
    try {
      const details = await districtsApi.show(districtId)
      district.value = details
      store.upsertRealtime(details)
    } catch (error: unknown) {
      fail(error, 'Не удалось открыть район')
    } finally {
      loading.value = false
    }
  }

  /**
   * Загрузить жителей, заявки и приглашения.
   */
  async function loadMembers(): Promise<void> {
    membersLoading.value = true
    try {
      const data = await districtsApi.members(districtId)
      residents.value = data.residents ?? []
      pending.value = isOwner.value ? (data.pending ?? []) : []
      invited.value = isOwner.value ? (data.invited ?? []) : []
      const role = data.role as DistrictDetails['role'] | undefined
      if (district.value && role) {
        district.value.role = role
      }
    } catch {
      residents.value = []
    } finally {
      membersLoading.value = false
    }
  }

  /**
   * Первичная загрузка страницы: карточка + состав.
   */
  async function init(): Promise<void> {
    if (!district.value) {
      await loadDistrict()
    }
    await loadMembers()
  }

  /**
   * Обновить карточку и состав после действия.
   */
  async function refresh(): Promise<void> {
    try {
      const details = await districtsApi.show(districtId)
      district.value = details
      store.upsertRealtime(details)
    } catch {}
    await loadMembers()
  }

  /**
   * Кинуть заявку в район.
   */
  async function join(): Promise<void> {
    try {
      await districtsApi.join(districtId)
      toast?.add({ severity: 'success', summary: 'Заявка отправлена', detail: 'Владелец решит, пускать ли вас', life: 3000 })
      await refresh()
    } catch (error: unknown) {
      fail(error, 'Не удалось отправить заявку')
    }
  }

  /**
   * Выйти из района / отозвать заявку.
   */
  async function leave(): Promise<void> {
    try {
      await districtsApi.leave(districtId)
      toast?.add({ severity: 'success', summary: 'Вы вышли из района', life: 2500 })
      await refresh()
    } catch (error: unknown) {
      fail(error, 'Не удалось выйти')
    }
  }

  /**
   * Принять приглашение в район.
   */
  async function acceptInvite(): Promise<void> {
    try {
      await districtsApi.acceptInvite(districtId)
      toast?.add({ severity: 'success', summary: 'Вы в районе', detail: 'Пины и общий чат открыты', life: 3000 })
      await refresh()
    } catch (error: unknown) {
      fail(error, 'Не удалось принять приглашение')
    }
  }

  /**
   * Отклонить приглашение в район.
   */
  async function declineInvite(): Promise<void> {
    try {
      await districtsApi.declineInvite(districtId)
      toast?.add({ severity: 'success', summary: 'Приглашение отклонено', life: 2500 })
      await refresh()
    } catch (error: unknown) {
      fail(error, 'Не удалось отклонить')
    }
  }

  /**
   * Одобрить заявку.
   *
   * @param userId автор заявки
   */
  async function approveMember(userId: number): Promise<void> {
    try {
      await districtsApi.approve(districtId, userId)
      toast?.add({ severity: 'success', summary: 'Житель принят', life: 2500 })
      await refresh()
    } catch (error: unknown) {
      fail(error, 'Не удалось одобрить')
    }
  }

  /**
   * Отклонить заявку.
   *
   * @param userId автор заявки
   */
  async function rejectMember(userId: number): Promise<void> {
    try {
      await districtsApi.reject(districtId, userId)
      await loadMembers()
    } catch (error: unknown) {
      fail(error, 'Не удалось отклонить')
    }
  }

  /**
   * Исключить жителя.
   *
   * @param userId житель
   */
  async function kickMember(userId: number): Promise<void> {
    try {
      await districtsApi.kick(districtId, userId)
      await refresh()
    } catch (error: unknown) {
      fail(error, 'Не удалось исключить')
    }
  }

  /**
   * Отозвать исходящее приглашение.
   *
   * @param userId кого отменяем
   */
  async function cancelInvite(userId: number): Promise<void> {
    try {
      await districtsApi.cancelInvite(districtId, userId)
      await refresh()
    } catch (error: unknown) {
      fail(error, 'Не удалось отозвать')
    }
  }

  /**
   * Открыть общий чат района.
   */
  function openChat(): void {
    const chatId = Number(district.value?.conversation_id)
    if (!(chatId > 0)) {
      return
    }
    router.visit(`/chat/${chatId}`)
  }

  /**
   * Написать владельцу в личку: открывает диалог 1-1 с админом.
   * Себе не пишем — кнопка скрыта через isOwner в шаблоне.
   */
  async function writeToOwner(): Promise<void> {
    const ownerId = Number(district.value?.owner?.id)
    if (!(ownerId > 0) || isOwner.value || writingOwner.value) {
      return
    }
    writingOwner.value = true
    try {
      const res = await chatApi.createConversation(ownerId)
      const chatId = Number(res?.id)
      if (chatId > 0) {
        router.visit(`/chat/${chatId}`)
      }
    } catch (error: unknown) {
      fail(error, 'Не удалось открыть чат')
    } finally {
      writingOwner.value = false
    }
  }

  /**
   * Открыть диалог приглашения (владелец).
   */
  function openInvite(): void {
    if (!district.value) {
      return
    }
    invite.show(Number(district.value.id), String(district.value.name ?? ''))
  }

  /**
   * Отправить приглашение из диалога.
   *
   * @param userId кого зовём
   */
  async function sendInvite(userId: number): Promise<void> {
    const sent = await invite.invite(userId)
    if (!sent) {
      return
    }
    toast?.add({ severity: 'success', summary: 'Приглашение отправлено', life: 2500 })
    await refresh()
  }

  /**
   * Поделиться ссылкой на район.
   */
  async function share(): Promise<void> {
    const url = `${window.location.origin}/districts/${districtId}`
    try {
      const canNativeShare = typeof navigator.share === 'function'
      if (canNativeShare) {
        await navigator.share({ title: district.value?.name ?? 'Район', url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast?.add({ severity: 'success', summary: 'Ссылка скопирована', life: 2000 })
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        toast?.add({ severity: 'success', summary: 'Ссылка скопирована', life: 2000 })
      } catch {}
    }
  }

  /**
   * Начать правки (владелец): заполнить черновик из карточки.
   */
  function startEdit(): void {
    editName.value = district.value?.name ?? ''
    editDescription.value = district.value?.description ?? ''
    editInterest.value = String(district.value?.interest ?? 'neighbors')
    editing.value = true
  }

  /**
   * Отменить правки.
   */
  function cancelEdit(): void {
    editing.value = false
  }

  /**
   * Сохранить правки названия/описания/интереса.
   *
   * @returns true когда сохранено
   */
  async function saveEdit(): Promise<boolean> {
    const clean = editName.value.trim()
    if (clean.length < 3) {
      toast?.add({ severity: 'warn', summary: 'Короткое название', detail: 'Минимум 3 символа', life: 2500 })
      return false
    }
    const description = editDescription.value.trim() || null
    const draft = { name: clean, description, interest: editInterest.value }
    const origin = district.value ?? {}
    if (isUnchangedPayload(draft, origin as Record<string, unknown>, ['name', 'description', 'interest'])) {
      toast?.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
      editing.value = false
      return true
    }
    saving.value = true
    try {
      const updated = await districtsApi.update(districtId, { name: clean, description, interest: editInterest.value })
      district.value = updated
      store.upsertRealtime(updated)
      editing.value = false
      toast?.add({ severity: 'success', summary: 'Сохранено', life: 2000 })
      return true
    } catch (error: unknown) {
      fail(error, 'Не удалось сохранить')
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Удалить район после подтверждения.
   */
  async function removeDistrict(): Promise<void> {
    const name = district.value?.name ?? 'без названия'
    const confirmed = await confirmDelete(`Сообщество «${name}» исчезнет вместе с общим чатом.`, 'Удалить район?')
    if (!confirmed) {
      return
    }
    try {
      await districtsApi.remove(districtId)
      store.removeRealtime(districtId)
      toast?.add({ severity: 'success', summary: 'Район удалён', life: 2500 })
      router.visit('/districts')
    } catch (error: unknown) {
      fail(error, 'Не удалось удалить')
    }
  }

  /**
   * Вернуться к карте.
   */
  function backToMap(): void {
    router.visit('/map')
  }

  /**
   * Выбрать таб страницы.
   *
   * @param tab ключ таба
   */
  function setTab(tab: 'feed' | 'members' | 'info' | 'requests'): void {
    activeTab.value = tab
  }

  const stopChanged = busOn('map:district-changed', (payload) => {
    const changedId = Number((payload as { id?: number })?.id)
    if (changedId === districtId) {
      void refresh()
    }
  })
  const stopDeleted = busOn('map:district-deleted', (payload) => {
    const deletedId = Number((payload as { id?: number })?.id)
    if (deletedId === districtId) {
      router.visit('/districts')
    }
  })

  let pollTimer: ReturnType<typeof setInterval> | null = null
  pollTimer = setInterval(() => {
    if (!document.hidden) {
      void refresh()
    }
  }, 30000)

  onBeforeUnmount(() => {
    try {
      stopChanged()
    } catch {}
    try {
      stopDeleted()
    } catch {}
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })

  /**
   * Подпись даты пина для ленты.
   *
   * @param pin пин из карточки района
   * @returns короткая дата или пусто
   */
  function pinDate(pin: { created_at?: string }): string {
    try {
      return new Date(String(pin.created_at)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    } catch {
      return ''
    }
  }

  /**
   * Открыть пин из ленты на карте.
   *
   * @param pin пин из карточки района
   */
  function openPin(pin: { id: number }): void {
    router.visit(`/map?pin=${Number(pin.id)}`)
  }

  return {
    district,
    residents,
    pending,
    invited,
    loading,
    membersLoading,
    activeTab,
    editing,
    editName,
    editDescription,
    editInterest,
    saving,
    writingOwner,
    isOwner,
    isMember,
    isGuest,
    isPending,
    isInvited,
    canChat,
    requestsCount,
    avatarLetter,
    interestLabel,
    typeLine,
    roleLabel,
    roleTone,
    coverUrl,
    cover,
    invite,
    init,
    refresh,
    join,
    leave,
    acceptInvite,
    declineInvite,
    approveMember,
    rejectMember,
    kickMember,
    cancelInvite,
    openChat,
    writeToOwner,
    openInvite,
    sendInvite,
    share,
    startEdit,
    cancelEdit,
    saveEdit,
    removeDistrict,
    backToMap,
    setTab,
    pinDate,
    openPin,
  }
}
