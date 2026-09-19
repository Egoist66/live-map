import { computed, onMounted, ref, watch } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { datingApi } from '@/services/dating.api'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel } from '@/composables/useUserChannel'
import { pokeRealtime } from '@/composables/useRealtimePoller'
import { useRewardToast } from '@/composables/useRewardToast'
import type { ActiveCard, SwipeCard, SwipeFilters, SwipeQuota } from '@/services/dating.api'

/** Лимит радиуса «рядом» для Free, км. PRO — безлимит. */
export const FREE_SWIPES_RADIUS_KM = 10

/** Табы свайпов с отдельными роутами. */
const SWIPE_TABS = ['feed', 'active', 'favorites', 'admirers', 'questionnaire', 'premium'] as const

/** Таб свайпов. */
export type SwipeTab = (typeof SWIPE_TABS)[number]

/**
 * Привести сырое значение к табу свайпов.
 *
 * Алиас tape ведёт на ленту.
 *
 * @param raw значение из роута или query
 * @returns таб свайпов, по умолчанию лента
 */
export function normalizeSwipeTab(raw: unknown): SwipeTab {
  const tab = String(raw ?? '')
  if (tab === 'tape') return 'feed'
  return (SWIPE_TABS as readonly string[]).includes(tab) ? (tab as SwipeTab) : 'feed'
}

/**
 * Путь таба свайпов для навигации с историей назад.
 *
 * @param tab таб свайпов
 * @returns путь вида /swipes/active
 */
export function swipeTabPath(tab: SwipeTab): string {
  return tab === 'feed' ? '/swipes/tape' : `/swipes/${tab}`
}

/**
 * Дейтинг-лента: свайпы, мэтчи, активные, фильтры, квоты, приватность.
 *
 * Лента по умолчанию без geo-ограничений: видны все люди в системе.
 * Компонент только отображает состояние хука.
 *
 * @returns состояние ленты и действия свайпов
 */
export function useSwipes() {
  const rewards = useRewardToast()
  const cards = ref<SwipeCard[]>([])
  const index = ref(0)
  const matches = ref<Array<{ match_id: number; conversation_id: number | null; user: { id: number; name: string; avatar_url: string | null } }>>([])
  const favorites = ref<SwipeCard[]>([])
  const favoritesLimit = ref(2)
  const favoritesLoading = ref(false)
  const admirers = ref<Array<SwipeCard & { is_incognito?: boolean }>>([])
  const admirersTotal = ref(0)
  const admirersIncognito = ref(0)
  const admirersLoading = ref(false)
  const incognitoLike = ref(false)
  const activeTab = ref<SwipeTab>('feed')
  const activeUsers = ref<ActiveCard[]>([])
  const activeLoading = ref(false)
  const loadingMoreLists = ref(false)
  const activeHasMore = ref(true)
  const activePage = ref(1)
  const favoritesHasMore = ref(true)
  const favoritesPage = ref(1)
  const admirersHasMore = ref(true)
  const admirersPage = ref(1)
  const matchesHasMore = ref(true)
  const matchesPage = ref(1)
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
  const savingPrivacy = ref(false)
  const showPaywall = ref(false)
  const paywallFeature = ref('')

  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)

  /**
   * Админ ли текущий пользователь (для сброса истории свайпов).
   *
   * @returns true если админ
   */
  const isAdmin = computed(() => !!authUser.value?.is_admin || authUser.value?.role === 'admin')

  /**
   * Может ли скрывать лайк: PRO / Business / админ.
   * @returns true если доступен анонимный лайк
   */
  const canIncognito = computed(() => {
    if (isAdmin.value) return true
    const plan = (authUser.value?.effective_plan || authUser.value?.plan || 'free') as string
    return plan === 'pro' || plan === 'business'
  })

  /**
   * Название тарифа для PRO-таба.
   *
   * @returns Free, PRO или Business
   */
  const planLabel = computed(() => {
    const plan = String(authUser.value?.effective_plan || authUser.value?.plan || 'free')
    if (plan === 'business') return 'Business'
    if (plan === 'pro') return 'PRO'
    return 'Free'
  })

  onMounted(() => {
    const propsTab = (page.props as unknown as { tab?: unknown }).tab
    const queryTab = new URLSearchParams(window.location.search).get('tab')
    activeTab.value = normalizeSwipeTab(propsTab ?? (queryTab === 'admirers' ? queryTab : null))
  })

  watch(
    () => (page.props as unknown as { tab?: unknown }).tab,
    async (raw) => {
      const tab = normalizeSwipeTab(raw)
      if (tab === activeTab.value) return
      activeTab.value = tab
      await loadTabData(tab)
    },
  )

  /**
   * Догрузить данные таба после перехода по роуту.
   *
   * @param tab таб свайпов
   */
  async function loadTabData(tab: SwipeTab): Promise<void> {
    if (tab === 'active') await loadActive()
    else if (tab === 'favorites') await loadFavorites()
    else if (tab === 'admirers') await loadAdmirers()
    else if (tab === 'feed') await loadFeed()
  }

  /**
   * Перейти на таб отдельным роутом, чтобы работала стрелка назад.
   *
   * @param tab таб свайпов
   */
  function goTab(tab: SwipeTab): void {
    if (activeTab.value === tab) return
    router.visit(swipeTabPath(tab))
  }

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
   * Сила штампа лайка 0..1. Лайк — свайп влево.
   *
   * @returns доля проявления
   */
  const likeStrength = computed(() => {
    if (leaving.value && flyDir.value === 'like') return 1
    return Math.max(0, Math.min(-dragX.value / 110, 1))
  })

  /**
   * Сила штампа паса 0..1. Пас — свайп вправо.
   *
   * @returns доля проявления
   */
  const passStrength = computed(() => {
    if (leaving.value && flyDir.value === 'pass') return 1
    return Math.max(0, Math.min(dragX.value / 110, 1))
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
      ageGateReason.value = err.response?.data?.age_gate_reason === 'underage' ? 'underage' : 'missing'
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
    if (err.response?.data?.quota) quota.value = err.response?.data?.quota as SwipeQuota
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
   * Загрузить активных сейчас в ULove (онлайн) — первая страница.
   * Дальше — loadMoreActive() по sentinel.
   * @returns void
   */
  async function loadActive(): Promise<void> {
    activeLoading.value = true
    error.value = null
    try {
      const res = await datingApi.active(1, 20)
      activeUsers.value = res.active
      quota.value = res.quota
      activePage.value = (res as { current_page?: number }).current_page ?? 1
      activeHasMore.value = !!(res as { has_more?: boolean }).has_more
    } catch (e: unknown) {
      if (handleGate(e)) return
      applyFeedError(e, 'Не удалось загрузить активных')
    } finally {
      activeLoading.value = false
    }
  }

  /**
   * Догрузить следующую страницу активных для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreActive(): Promise<boolean> {
    if (activeLoading.value || loadingMoreLists.value || !activeHasMore.value) return false
    loadingMoreLists.value = true
    try {
      const next = activePage.value + 1
      const res = await datingApi.active(next, 20)
      const rows = res.active ?? []
      const known = new Set(activeUsers.value.map((u) => u.id))
      const fresh = rows.filter((u) => !known.has(u.id))
      activeUsers.value = [...activeUsers.value, ...fresh]
      activePage.value = (res as { current_page?: number }).current_page ?? next
      activeHasMore.value = !!(res as { has_more?: boolean }).has_more && rows.length > 0
      if ((res as { quota?: SwipeQuota }).quota) quota.value = (res as { quota: SwipeQuota }).quota
      return fresh.length > 0
    } catch { return false } finally { loadingMoreLists.value = false }
  }

  /**
   * Подписаться на realtime мэтчей/лайков: обновляет шапку мэтчей,
   * даже если уведомление прилетело вне страницы ULove.
   * @returns функция отписки
   */
  function subscribeRealtime(): () => void {
    try {
      const offs: Array<() => void> = []
      const onMatch = () => {
        void loadMatches()
        void loadFavorites()
      }
      const onLiked = () => {
        void loadFeed()
        void loadAdmirers()
      }
      ensureUserChannel()
      offs.push(busOn('user:match.created', () => onMatch()))
      offs.push(busOn('user:swipe.liked', () => onLiked()))
      offs.push(busOn('notify:match', () => onMatch()))
      offs.push(busOn('notify:swipe', () => onLiked()))
      return () => {
        offs.forEach((off) => {
          try { off() } catch { return }
        })
      }
    } catch { return () => {} }
  }

  /**
   * Загрузить мэтчи — первая страница, дальше loadMoreMatches().
   *
   * @returns void
   */
  async function loadMatches(): Promise<void> {
    try {
      const res = await datingApi.matches(1, 20)
      matches.value = res.matches
      quota.value = res.quota
      matchesPage.value = (res as { current_page?: number }).current_page ?? 1
      matchesHasMore.value = !!(res as { has_more?: boolean }).has_more
    } catch (e: unknown) {
      if (handleGate(e)) return
      matches.value = []
    }
  }

  /**
   * Догрузить мэтчи для горизонтального infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreMatches(): Promise<boolean> {
    if (loadingMoreLists.value || !matchesHasMore.value) return false
    loadingMoreLists.value = true
    try {
      const next = matchesPage.value + 1
      const res = await datingApi.matches(next, 20)
      const rows = res.matches ?? []
      const known = new Set(matches.value.map((m) => m.match_id))
      const fresh = rows.filter((m) => !known.has(m.match_id))
      matches.value = [...matches.value, ...fresh]
      matchesPage.value = (res as { current_page?: number }).current_page ?? next
      matchesHasMore.value = !!(res as { has_more?: boolean }).has_more && rows.length > 0
      return fresh.length > 0
    } catch { return false } finally { loadingMoreLists.value = false }
  }

  /**
   * Загрузить избранное (лайкнутые без мэтча) — первая страница.
   *
   * @returns void
   */
  async function loadFavorites(): Promise<void> {
    favoritesLoading.value = true
    try {
      const res = await datingApi.favorites(1, 20)
      favorites.value = res.favorites
      favoritesLimit.value = res.limit
      favoritesPage.value = (res as { current_page?: number }).current_page ?? 1
      favoritesHasMore.value = !!(res as { has_more?: boolean }).has_more
    } catch (e: unknown) {
      if (handleGate(e)) return
      favorites.value = []
    } finally {
      favoritesLoading.value = false
    }
  }

  /**
   * Догрузить избранное для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreFavorites(): Promise<boolean> {
    if (favoritesLoading.value || loadingMoreLists.value || !favoritesHasMore.value) return false
    loadingMoreLists.value = true
    try {
      const next = favoritesPage.value + 1
      const res = await datingApi.favorites(next, 20)
      const rows = res.favorites ?? []
      const known = new Set(favorites.value.map((f) => f.id))
      const fresh = rows.filter((f) => !known.has(f.id))
      favorites.value = [...favorites.value, ...fresh]
      favoritesPage.value = (res as { current_page?: number }).current_page ?? next
      favoritesHasMore.value = !!(res as { has_more?: boolean }).has_more && rows.length > 0
      return fresh.length > 0
    } catch { return false } finally { loadingMoreLists.value = false }
  }

  /**
   * Загрузить «Кто меня лайкнул» — первая страница.
   * @returns void
   */
  async function loadAdmirers(): Promise<void> {
    admirersLoading.value = true
    try {
      const res = await datingApi.admirers(1, 20)
      admirers.value = res.admirers
      admirersTotal.value = res.total
      admirersIncognito.value = res.incognito_count
      admirersPage.value = (res as { current_page?: number }).current_page ?? 1
      admirersHasMore.value = !!(res as { has_more?: boolean }).has_more
    } catch (e: unknown) {
      if (handleGate(e)) return
      admirers.value = []
    } finally {
      admirersLoading.value = false
    }
  }

  /**
   * Догрузить поклонников для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreAdmirers(): Promise<boolean> {
    if (admirersLoading.value || loadingMoreLists.value || !admirersHasMore.value) return false
    loadingMoreLists.value = true
    try {
      const next = admirersPage.value + 1
      const res = await datingApi.admirers(next, 20)
      const rows = res.admirers ?? []
      const known = new Set(admirers.value.map((a) => `${a.id}-${a.is_incognito ? 'inc' : 'open'}`))
      const fresh = rows.filter((a) => !known.has(`${a.id}-${a.is_incognito ? 'inc' : 'open'}`))
      admirers.value = [...admirers.value, ...fresh]
      admirersPage.value = (res as { current_page?: number }).current_page ?? next
      admirersHasMore.value = !!(res as { has_more?: boolean }).has_more && rows.length > 0
      admirersTotal.value = res.total ?? admirersTotal.value
      return fresh.length > 0
    } catch { return false } finally { loadingMoreLists.value = false }
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
   * PRO может лайкнуть инкогнито: себя скрыть, но в уведомления попасть.
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
      const useIncognito = action === 'like' && incognitoLike.value && canIncognito.value
      const pending = datingApi.act(card.id, action, useIncognito)
      await waitFrame(360)
      const res = await pending
      quota.value = res.quota
      rewards.applyReward(res)
      if (res.matched) {
        matchedCard.value = card
        matchedConversationId.value = res.conversation_id
        await loadMatches()
      }
      index.value += 1
      if (action === 'like') void loadFavorites()
      if (action === 'like') {
        try { pokeRealtime() } catch {}
      }
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
   * Шлёт exclude_ids виденных — бэк исключает дубли без сброса истории.
   *
   * @returns void
   */
  async function loadMore(): Promise<void> {
    try {
      const exclude = cards.value.map((c) => c.id).slice(-200)
      const res = await datingApi.feed(filters.value, exclude, 20)
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
      if (err.response?.data?.quota) quota.value = err.response?.data?.quota as SwipeQuota
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
   * При успехе закрывает модалку фильтров.
   *
   * @returns true если сохранение прошло успешно
   */
  async function savePrivacy(): Promise<boolean> {
    if (savingPrivacy.value) {
      return false
    }
    savingPrivacy.value = true
    error.value = null
    try {
      await datingApi.updateSettings({ ...privacy.value })
      showFilters.value = false
      return true
    } catch (e: unknown) {
      if (handleGate(e)) return false
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось сохранить приватность'
      return false
    } finally {
      savingPrivacy.value = false
    }
  }

  /**
   * Попросить PRO для платной плюшки.
   *
   * @param feature название плюшки для окна
   */
  function askPremium(feature: string): void {
    paywallFeature.value = feature
    showPaywall.value = true
  }

  /**
   * Закрыть окно PRO.
   */
  function closePaywall(): void {
    showPaywall.value = false
  }

  /**
   * Включить/выключить инкогнито-лайк с проверкой тарифа.
   *
   * Без PRO показывает окно с просьбой оформить подписку.
   *
   * @param next новое значение
   */
  function setIncognito(next: boolean): void {
    if (next && !canIncognito.value) {
      askPremium('Инкогнито-лайк')
      return
    }
    incognitoLike.value = next
  }

  /**
   * Переключить флаг приватности с проверкой тарифа.
   *
   * Скрытие имени/возраста — PRO, «только мэтчи» — бесплатно.
   *
   * @param key флаг приватности
   * @param next новое значение
   */
  async function setPrivacyFlag(key: 'dating_hide_name' | 'dating_hide_age' | 'dating_match_only', next: boolean): Promise<void> {
    const needsPro = key !== 'dating_match_only'
    if (next && needsPro && !canIncognito.value) {
      const featureName = key === 'dating_hide_name' ? 'Скрытие имени' : 'Скрытие возраста'
      askPremium(featureName)
      return
    }
    privacy.value[key] = next
    await savePrivacy()
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
   * Влево — лайк, вправо — пас.
   *
   * @returns void
   */
  async function dragEnd(): Promise<void> {
    if (!dragging.value || leaving.value) return
    dragging.value = false
    const threshold = 110
    const shiftX = dragX.value
    if (shiftX < -threshold) {
      await swipe('like')
      return
    }
    if (shiftX > threshold) {
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
      if (err.response?.data?.quota) quota.value = err.response?.data?.quota as SwipeQuota
      error.value = err.response?.data?.message ?? 'Не удалось сбросить свайпы'
    } finally {
      resetting.value = false
    }
  }

  /**
   * Лайк в ответ из «Меня лайкнули».
   * @param userId id пользователя
   */
  async function swipeAdmirer(userId: number): Promise<void> {
    if (acting.value) return
    acting.value = true
    error.value = null
    try {
      const res = await datingApi.act(userId, 'like', false)
      quota.value = res.quota
      rewards.applyReward(res)
      if (res.matched) {
        await loadMatches()
        await loadAdmirers()
      }
      cards.value = cards.value.filter((c) => c.id !== userId)
      admirers.value = admirers.value.map((a) => (a.id === userId ? { ...a, is_match: true } : a))
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось отправить лайк'
    } finally {
      acting.value = false
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
    matchesHasMore,
    favorites,
    favoritesLimit,
    favoritesCount,
    favoritesLoading,
    favoritesHasMore,
    admirers,
    admirersTotal,
    admirersIncognito,
    admirersLoading,
    admirersHasMore,
    loadAdmirers,
    loadMoreAdmirers,
    incognitoLike,
    canIncognito,
    planLabel,
    activeTab,
    goTab,
    activeUsers,
    activeLoading,
    activeHasMore,
    loadActive,
    loadMoreActive,
    hasActiveFilters,
    feedExhausted,
    loadFavorites,
    loadMoreFavorites,
    loadingMoreLists,
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
    loadMoreMatches,
    subscribeRealtime,
    applyFilters,
    resetFilters,
    swipe,
    toggleInterest,
    openChat,
    writeWithoutMatch,
    swipeAdmirer,
    savePrivacy,
    savingPrivacy,
    showPaywall,
    paywallFeature,
    closePaywall,
    setIncognito,
    setPrivacyFlag,
    dragStart,
    dragMove,
    dragEnd,
    closeMatch,
  }
}
