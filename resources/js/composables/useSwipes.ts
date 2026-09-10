import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { datingApi } from '@/services/dating.api'
import type { ActiveCard, SwipeCard, SwipeFilters, SwipeQuota } from '@/services/dating.api'

/** Лимит радиуса «рядом» для Free, км. PRO — безлимит. */
export const FREE_SWIPES_RADIUS_KM = 10

/**
 * Дейтинг-лента: свайпы, мэтчи, активные, фильтры, квоты, приватность.
 *
 * Лента по умолчанию без geo-ограничений: видны все люди в системе.
 * Компонент только отображает состояние хука.
 *
 * @returns состояние ленты и действия свайпов
 */
export function useSwipes() {
  const cards = ref<SwipeCard[]>([])
  const index = ref(0)
  const matches = ref<Array<{ match_id: number; conversation_id: number | null; user: { id: number; name: string; avatar_url: string | null } }>>([])
  const favorites = ref<SwipeCard[]>([])
  const favoritesLimit = ref(2)
  const favoritesLoading = ref(false)
  const activeTab = ref<'feed' | 'active' | 'favorites'>('feed')
  const activeUsers = ref<ActiveCard[]>([])
  const activeLoading = ref(false)
  const quota = ref<SwipeQuota | null>(null)
  const loading = ref(false)
  const acting = ref(false)
  const error = ref<string | null>(null)
  const showFilters = ref(false)
  const showHelp = ref(false)
  const matchedCard = ref<SwipeCard | null>(null)
  const matchedConversationId = ref<number | null>(null)
  const creatingChat = ref(false)
  const ageGate = ref(false)
  const ageGateReason = ref<'missing' | 'underage'>('missing')
  const birthDate = ref<Date | null>(null)
  const verifying = ref(false)
  const resetting = ref(false)

  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)

  /**
   * Админ ли текущий пользователь (для сброса истории свайпов).
   *
   * @returns true если админ
   */
  const isAdmin = computed(() => !!authUser.value?.is_admin || authUser.value?.role === 'admin')

  const filters = ref<SwipeFilters>({
    goal: null,
    gender: 'all',
    age_min: null,
    age_max: null,
    radius_km: null,
    interests: [],
  })

  const privacy = ref({
    dating_match_only: false,
    dating_hide_name: false,
    dating_hide_age: false,
  })

  const dragX = ref(0)
  const dragY = ref(0)
  const dragging = ref(false)
  const dragStartX = ref(0)
  const dragStartY = ref(0)
  const leaving = ref(false)
  const flyDir = ref<'like' | 'pass' | null>(null)
  const exiting = ref<{ card: SwipeCard; dir: 'like' | 'pass'; fromX: number; fromY: number } | null>(null)

  const current = computed(() => cards.value[index.value] ?? null)
  const next = computed(() => cards.value[index.value + 1] ?? null)
  const hasMore = computed(() => index.value < cards.value.length)
  const seenCount = computed(() => Math.min(index.value, cards.value.length))
  const favoritesCount = computed(() => favorites.value.length)

  /**
   * Есть ли активные фильтры ленты.
   *
   * @returns true если хоть один фильтр задан
   */
  const hasActiveFilters = computed(() => {
    const f = filters.value
    return !!(f.goal || (f.gender && f.gender !== 'all') || f.age_min || f.age_max || f.radius_km || (f.interests && f.interests.length))
  })

  /**
   * Лента исчерпана: загрузка кончилась, а карточек нет.
   *
   * @returns true когда всех просвайпали
   */
  const feedExhausted = computed(() => !loading.value && !error.value && !current.value && cards.value.length === 0)

  const quotaLabel = computed(() => {
    if (!quota.value) return ''
    if (quota.value.limit < 0) return 'Безлимит'
    return `Сообщения: ${quota.value.left}/${quota.value.limit}`
  })

  /** Лимит радиуса по тарифу. Null — безлимит (PRO). */
  const radiusLimit = computed(() => quota.value?.radius_limit ?? FREE_SWIPES_RADIUS_KM)

  /** Доступен ли сброс истории (админ — всегда, остальные — один раз). */
  const canResetHistory = computed(() => quota.value?.can_reset ?? false)

  /**
   * Подпись радиуса с пометкой PRO.
   * @param km радиус в км
   * @returns true если радиус требует PRO
   */
  function isRadiusPro(km: number | null): boolean {
    if (km == null) return false
    const limit = radiusLimit.value
    if (limit == null) return false
    return km > limit
  }

  const isQuotaEmpty = computed(() => {
    if (!quota.value) return false
    if (quota.value.limit < 0) return false
    return quota.value.left <= 0
  })

  /**
   * Стиль верхней карты колоды: только драг.
   *
   * Улёт играет отдельный оверлей exiting, чтобы следующая карта стояла спокойно.
   *
   * @returns css-стиль transform/transition/opacity
   */
  const topCardStyle = computed(() => {
    if (leaving.value) {
      return {
        transform: 'scale(.96)',
        transition: 'none',
        opacity: '0',
      }
    }
    const rotate = dragX.value / 16
    return {
      transform: `translate(${dragX.value}px, ${dragY.value}px) rotate(${rotate}deg)`,
      transition: dragging.value ? 'none' : 'transform .28s cubic-bezier(.2,.7,.25,1.2)',
      opacity: '1',
    }
  })

  /**
   * Стиль следующей карты: подъезжает только пока тянут.
   *
   * @returns css-стиль для подложки
   */
  const stackCardStyle = computed(() => {
    const pull = Math.min(Math.abs(dragX.value) / 120, 1)
    const scale = dragging.value ? 0.94 + pull * 0.06 : 0.94
    const y = dragging.value ? 12 - pull * 12 : 12
    return {
      transform: `scale(${scale}) translateY(${y}px)`,
      transition: dragging.value ? 'none' : 'transform .28s ease',
    }
  })

  /**
   * Сила штампа лайка 0..1.
   *
   * @returns доля проявления
   */
  const likeStrength = computed(() => {
    if (leaving.value && flyDir.value === 'like') return 1
    return Math.max(0, Math.min(dragX.value / 110, 1))
  })

  /**
   * Сила штампа паса 0..1.
   *
   * @returns доля проявления
   */
  const passStrength = computed(() => {
    if (leaving.value && flyDir.value === 'pass') return 1
    return Math.max(0, Math.min(-dragX.value / 110, 1))
  })

  /** Максимальная дата рождения для гейта 18+ (сегодня минус 18 лет). */
  const adultMaxDate = computed(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d
  })

  /**
   * Перехватить ответ гейта 18+ и поднять модалку.
   *
   * @param e ошибка запроса
   * @returns true если это гейт возраста
   */
  function handleGate(e: unknown): boolean {
    const err = e as { response?: { status?: number; data?: { age_gate?: boolean; age_gate_reason?: string } } }
    if (err.response?.status === 403 && err.response?.data?.age_gate === true) {
      ageGateReason.value = err.response.data.age_gate_reason === 'underage' ? 'underage' : 'missing'
      ageGate.value = true
      return true
    }
    return false
  }

  /**
   * Подтвердить возраст датой рождения (один раз, строго 18+).
   *
   * @returns void
   */
  async function verifyAge(): Promise<void> {
    if (!birthDate.value || verifying.value) return
    verifying.value = true
    error.value = null
    try {
      const d = birthDate.value
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      await datingApi.verifyAge(iso)
      birthDate.value = null
      ageGate.value = false
      await loadFeed()
      await loadMatches()
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const fieldErr = err.response?.data?.errors?.birth_date?.[0]
      error.value = fieldErr ?? err.response?.data?.message ?? 'Не удалось подтвердить возраст'
    } finally {
      verifying.value = false
    }
  }

  /** Текстовые прокси возраста для InputText (PrimeVue работает со строками). */
  const ageMinText = computed({
    get: () => (filters.value.age_min == null ? '' : String(filters.value.age_min)),
    set: (v: string) => {
      const n = parseInt(v, 10)
      filters.value.age_min = Number.isFinite(n) ? Math.min(99, Math.max(18, n)) : null
    },
  })
  const ageMaxText = computed({
    get: () => (filters.value.age_max == null ? '' : String(filters.value.age_max)),
    set: (v: string) => {
      const n = parseInt(v, 10)
      filters.value.age_max = Number.isFinite(n) ? Math.min(99, Math.max(18, n)) : null
    },
  })

  /**
   * Подпись цели знакомства.
   *
   * @param goal ключ цели
   * @returns человекочитаемая подпись
   */
  function goalLabel(goal: string | null): string {
    const map: Record<string, string> = {
      love: 'Отношения',
      flirt: 'Флирт',
      friendship: 'Дружба',
      chat: 'Общение',
      interests: 'По интересам',
    }
    if (!goal) return 'Без цели'
    return map[goal] ?? goal
  }

  /**
   * Подпись возраста: всегда видна, с фолбэком.
   *
   * @param card карточка кандидата
   * @returns возраст или пояснение
   */
  function ageLabel(card: SwipeCard | null): string {
    if (!card) return ''
    if (card.age != null) return String(card.age)
    if (card.age_hidden) return 'возраст скрыт'
    return 'возраст не указан'
  }

  /**
   * Загрузить ленту кандидатов.
   *
   * @returns void
   */
  /**
   * Пауза для проигрывания улёта карты.
   *
   * @param ms миллисекунды
   * @returns void
   */
  async function waitFrame(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Записать ошибку ленты и подтянуть квоту из ответа.
   * @param e ошибка запроса
   * @param fallback запасной текст
   * @returns void
   */
  function applyFeedError(e: unknown, fallback: string): void {
    const err = e as { response?: { data?: { message?: string; quota?: SwipeQuota } } }
    if (err.response?.data?.quota) quota.value = err.response.data.quota
    error.value = err.response?.data?.message ?? fallback
  }

  async function loadFeed(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await datingApi.feed(filters.value)
      cards.value = res.cards
      quota.value = res.quota
      index.value = 0
      dragX.value = 0
      dragY.value = 0
      leaving.value = false
      flyDir.value = null
      exiting.value = null
    } catch (e: unknown) {
      if (handleGate(e)) return
      applyFeedError(e, 'Не удалось загрузить ленту')
    } finally {
      loading.value = false
    }
  }

  /**
   * Загрузить активных сейчас в ULove (онлайн).
   * @returns void
   */
  async function loadActive(): Promise<void> {
    activeLoading.value = true
    error.value = null
    try {
      const res = await datingApi.active()
      activeUsers.value = res.active
      quota.value = res.quota
    } catch (e: unknown) {
      if (handleGate(e)) return
      applyFeedError(e, 'Не удалось загрузить активных')
    } finally {
      activeLoading.value = false
    }
  }

  /**
   * Загрузить мэтчи.
   *
   * @returns void
   */
  async function loadMatches(): Promise<void> {
    try {
      const res = await datingApi.matches()
      matches.value = res.matches
      quota.value = res.quota
    } catch (e: unknown) {
      if (handleGate(e)) return
      matches.value = []
    }
  }

  /**
   * Загрузить избранное (лайкнутые без мэтча).
   *
   * @returns void
   */
  async function loadFavorites(): Promise<void> {
    favoritesLoading.value = true
    try {
      const res = await datingApi.favorites()
      favorites.value = res.favorites
      favoritesLimit.value = res.limit
    } catch (e: unknown) {
      if (handleGate(e)) return
      favorites.value = []
    } finally {
      favoritesLoading.value = false
    }
  }

  /**
   * Убрать человека из избранного.
   *
   * @param userId id пользователя
   * @returns void
   */
  async function removeFavorite(userId: number): Promise<void> {
    try {
      await datingApi.removeFavorite(userId)
      favorites.value = favorites.value.filter((f) => f.id !== userId)
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось убрать из избранного'
    }
  }

  /**
   * Применить фильтры и перезагрузить ленту.
   *
   * @returns void
   */
  async function applyFilters(): Promise<void> {
    showFilters.value = false
    await loadFeed()
  }

  /**
   * Сбросить фильтры.
   *
   * @returns void
   */
  async function resetFilters(): Promise<void> {
    filters.value = {
      goal: null,
      gender: 'all',
      age_min: null,
      age_max: null,
      radius_km: null,
      interests: [],
    }
    await loadFeed()
  }

  /**
   * Отправить свайп за текущую карточку с улётом за экран.
   *
   * @param action like|pass
   * @returns void
   */
  async function swipe(action: 'like' | 'pass'): Promise<void> {
    const card = current.value
    if (!card || acting.value || leaving.value) return
    acting.value = true
    leaving.value = true
    flyDir.value = action
    exiting.value = { card, dir: action, fromX: dragX.value, fromY: dragY.value }
    dragging.value = false
    dragX.value = 0
    dragY.value = 0
    error.value = null
    try {
      const pending = datingApi.act(card.id, action)
      await waitFrame(360)
      const res = await pending
      quota.value = res.quota
      if (res.matched) {
        matchedCard.value = card
        matchedConversationId.value = res.conversation_id
        await loadMatches()
      }
      index.value += 1
      if (action === 'like') void loadFavorites()
      if (index.value >= cards.value.length - 3) {
        void loadMore()
      }
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось отправить свайп'
    } finally {
      exiting.value = null
      leaving.value = false
      flyDir.value = null
      acting.value = false
    }
  }

  /**
   * Догрузить ленту в фоне, когда карточки заканчиваются.
   *
   * @returns void
   */
  async function loadMore(): Promise<void> {
    try {
      const res = await datingApi.feed(filters.value)
      quota.value = res.quota
      const known = new Set(cards.value.map((c) => c.id))
      const fresh = res.cards.filter((c) => !known.has(c.id))
      cards.value = [...cards.value, ...fresh]
    } catch {
      return
    }
  }

  /**
   * Перейти в готовый чат приложения с дейтинг-темой.
   *
   * Если id комнаты уже известен (мэтч), открываем её сразу,
   * иначе создаём через готовую систему чатов.
   *
   * @param userId id собеседника
   * @param conversationId известный id комнаты (мэтч)
   * @returns void
   */
  async function openChat(userId: number, conversationId?: number | null): Promise<void> {
    if (conversationId) {
      matchedCard.value = null
      matchedConversationId.value = null
      router.visit(`/chat/${conversationId}?from=swipes`)
      return
    }
    creatingChat.value = true
    error.value = null
    try {
      const res = await chatApi.createConversation(userId)
      matchedCard.value = null
      matchedConversationId.value = null
      router.visit(`/chat/${res.id}?from=swipes`)
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string; quota?: SwipeQuota } } }
      if (err.response?.data?.quota) quota.value = err.response.data.quota
      error.value = err.response?.data?.message ?? 'Не удалось открыть чат'
    } finally {
      creatingChat.value = false
    }
  }

  /**
   * Написать без мэтча (тратит квоту free 3 / pro 10).
   *
   * @param userId id собеседника
   * @returns void
   */
  async function writeWithoutMatch(userId: number): Promise<void> {
    await openChat(userId)
  }

  /**
   * Сохранить приватность дейтинга.
   *
   * @returns void
   */
  async function savePrivacy(): Promise<void> {
    error.value = null
    try {
      await datingApi.updateSettings({ ...privacy.value })
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось сохранить приватность'
    }
  }

  /**
   * Начало перетаскивания карточки.
   *
   * @param clientX координата X
   * @param clientY координата Y
   * @returns void
   */
  function dragStart(clientX: number, clientY = 0): void {
    if (acting.value || leaving.value) return
    dragging.value = true
    dragStartX.value = clientX
    dragStartY.value = clientY
  }

  /**
   * Движение перетаскивания.
   *
   * @param clientX координата X
   * @param clientY координата Y
   * @returns void
   */
  function dragMove(clientX: number, clientY = 0): void {
    if (!dragging.value || leaving.value) return
    const nextX = clientX - dragStartX.value
    const nextY = clientY - dragStartY.value
    dragX.value = Math.max(-260, Math.min(260, nextX))
    dragY.value = Math.max(-120, Math.min(120, nextY))
  }

  /**
   * Конец перетаскивания: резкий сдвиг = улёт.
   *
   * @returns void
   */
  async function dragEnd(): Promise<void> {
    if (!dragging.value || leaving.value) return
    dragging.value = false
    const threshold = 110
    const shiftX = dragX.value
    if (shiftX > threshold) {
      await swipe('like')
      return
    }
    if (shiftX < -threshold) {
      await swipe('pass')
      return
    }
    dragX.value = 0
    dragY.value = 0
  }

  /**
   * Переключить тег интереса в фильтре.
   *
   * @param tag тег интереса
   * @returns void
   */
  function toggleInterest(tag: string): void {
    const list = filters.value.interests
    const at = list.indexOf(tag)
    if (at >= 0) {
      filters.value.interests = list.filter((t) => t !== tag)
    } else if (list.length < 5) {
      filters.value.interests = [...list, tag]
    }
  }

  /**
   * Сбросить просмотренные свайпы и снова листать всех.
   *
   * Админ — безлимитно, обычный пользователь — один раз (Free).
   * Чистит историю like/pass, перезагружает ленту с избранным.
   *
   * @returns void
   */
  async function resetHistory(): Promise<void> {
    if (resetting.value || !canResetHistory.value) return
    resetting.value = true
    error.value = null
    try {
      const res = await datingApi.resetHistory()
      if (res.quota) quota.value = res.quota
      await loadFeed()
      await loadFavorites()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; quota?: SwipeQuota } } }
      if (err.response?.data?.quota) quota.value = err.response.data.quota
      error.value = err.response?.data?.message ?? 'Не удалось сбросить свайпы'
    } finally {
      resetting.value = false
    }
  }

  /**
   * Закрыть окно мэтча.
   *
   * @returns void
   */
  function closeMatch(): void {
    matchedCard.value = null
    matchedConversationId.value = null
  }

  return {
    cards,
    index,
    current,
    next,
    leaving,
    flyDir,
    exiting,
    hasMore,
    seenCount,
    matches,
    favorites,
    favoritesLimit,
    favoritesCount,
    favoritesLoading,
    activeTab,
    activeUsers,
    activeLoading,
    loadActive,
    hasActiveFilters,
    feedExhausted,
    loadFavorites,
    removeFavorite,
    quota,
    quotaLabel,
    isQuotaEmpty,
    radiusLimit,
    canResetHistory,
    isRadiusPro,
    filters,
    privacy,
    ageMinText,
    ageMaxText,
    loading,
    acting,
    creatingChat,
    ageGate,
    ageGateReason,
    birthDate,
    verifying,
    resetting,
    isAdmin,
    resetHistory,
    adultMaxDate,
    verifyAge,
    error,
    showFilters,
    showHelp,
    matchedCard,
    matchedConversationId,
    dragX,
    dragY,
    dragging,
    topCardStyle,
    stackCardStyle,
    likeStrength,
    passStrength,
    goalLabel,
    ageLabel,
    loadFeed,
    loadMatches,
    applyFilters,
    resetFilters,
    swipe,
    toggleInterest,
    openChat,
    writeWithoutMatch,
    savePrivacy,
    dragStart,
    dragMove,
    dragEnd,
    closeMatch,
  }
}
