import { computed, onMounted, ref, watch } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { datingApi } from '@/services/dating.api'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel } from '@/composables/useUserChannel'
import { pokeRealtime } from '@/composables/useRealtimePoller'
import { shouldSkipMotion } from '@/composables/useMotion'
import { useRewardToast } from '@/composables/useRewardToast'
import type { ActiveCard, SwipeCard, SwipeExtras, SwipeFilters, SwipeQuota } from '@/services/dating.api'

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
  const favoritesLimit = ref(3)
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
  /** На ком висит лоадер: id кандидата (null — неизвестно/лента). */
  const actingId = ref<number | null>(null)
  /** Какая кнопка крутит лоадер: у каждой своё состояние. */
  const actingAction = ref<null | 'pass' | 'like' | 'superlike'>(null)
  const error = ref<string | null>(null)
  const showFilters = ref(false)
  const showHelp = ref(false)
  const matchedCard = ref<SwipeCard | null>(null)
  const matchedConversationId = ref<number | null>(null)
  const creatingChat = ref(false)
  const ageGate = ref(false)
  const ageGateReason = ref<'missing' | 'underage'>('missing')
  /** Бэк отклонил лайк из-за неподтверждённой почты. */
  const needsEmailVerification = ref(false)
  const birthDate = ref<Date | null>(null)
  const verifying = ref(false)
  const resetting = ref(false)
  const savingPrivacy = ref(false)
  const showPaywall = ref(false)
  const paywallFeature = ref('')
  const buyingExtras = ref(false)
  /** Последний свайп в ленте — кандидат на откат (только свежий). */
  const lastSwiped = ref<{ card: SwipeCard; action: 'like' | 'pass' | 'superlike' } | null>(null)

  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)

  /**
   * Стафф ли текущий пользователь (админ или модератор).
   * Стафф всегда на Premium: сброс свайпов безлимитный.
   *
   * @returns true если админ или модератор
   */
  const isStaff = computed(() => !!authUser.value?.is_admin || authUser.value?.role === 'admin' || authUser.value?.role === 'moderator')

  /**
   * Топ-тариф ли это (максимум лимитов): premium/business/стафф.
   *
   * @returns true если включён Premium
   */
  const isPremium = computed(() => {
    if (isStaff.value) {
      return true
    }

    const plan = authUser.value?.effective_plan || authUser.value?.plan || 'free'

    return plan === 'premium' || plan === 'business'
  })

  /**
   * Админ ли текущий пользователь (для сброса истории свайпов).
   *
   * @returns true если админ
   */
  const isAdmin = computed(() => !!authUser.value?.is_admin || authUser.value?.role === 'admin')

  /**
   * PRO-тариф: pro/premium/business/стафф. Даёт безлимитный сброс ленты и PRO-плюшки.
   *
   * Модератор — тоже стафф: сброс безлимитный даже при plan=free,
   * т.к. бэк считает effective_plan=premium (см. User::effectivePlan).
   *
   * @returns true если включён PRO
   */
  const isPro = computed(() => {
    if (isStaff.value) {
      return true
    }

    const plan = authUser.value?.effective_plan || authUser.value?.plan || 'free'

    return plan === 'pro' || plan === 'premium' || plan === 'business'
  })

  /**
   * Может ли скрывать лайк: PRO / Business / админ.
   * @returns true если доступен анонимный лайк
   */
  const canIncognito = computed(() => isPro.value)

  /**
   * Почта подтверждена: лайки и суперлайки разрешены.
   *
   * @returns true когда email_verified_at заполнен
   */
  const isEmailVerified = computed(() => !!authUser.value?.email_verified_at)

  /**
   * Можно ли лайкать: с подтверждённой почтой либо стаффу.
   *
   * Пас и просмотр ленты/избранного доступны всем.
   *
   * @returns true если лайк не упрётся в гейт почты
   */
  const canLike = computed(() => isEmailVerified.value || isStaff.value)

  /**
   * Перехватить ответ гейта почты и поднять флаг баннера.
   *
   * @param e ошибка запроса
   * @returns true если это гейт неподтверждённой почты
   */
  function handleEmailGate(e: unknown): boolean {
    const err = e as { response?: { status?: number; data?: { email_unverified?: boolean; message?: string } } }
    if (err.response?.status === 403 && err.response?.data?.email_unverified === true) {
      needsEmailVerification.value = true
      error.value = err.response?.data?.message ?? 'Подтверди почту, чтобы лайкать'
      return true
    }
    return false
  }

  /**
   * Клиентский гейт лайка: без подтверждённой почты
   * сразу показываем подсказку, не дёргая бэк.
   *
   * @returns true если лайкать можно
   */
  function ensureCanLike(): boolean {
    if (canLike.value) {
      return true
    }
    needsEmailVerification.value = true
    error.value = 'Лайки доступны после подтверждения почты. Проверь письмо со ссылкой — пока работает только избранное.'
    return false
  }

  /**
   * Название тарифа для PRO-таба.
   *
   * @returns Free, PRO, Premium или Business (Business — только организаторы)
   */
  const planLabel = computed(() => {
    const plan = String(authUser.value?.effective_plan || authUser.value?.plan || 'free')
    if (plan === 'business') return 'Business'
    if (plan === 'premium') return 'Premium'
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

  /**
   * Открыт таб-роут вместо ленты (активные, избранное, лайки,
   * анкета, PRO): сверху нужна стрелка назад к ленте.
   */
  const showTabBack = computed(() => activeTab.value !== 'feed')

  /**
   * Контентный таб (всё кроме ленты): списки, анкета, PRO.
   *
   * Листаются обычным скроллом страницы в родителе (main без
   * overflow-hidden, нижнее меню видно) — никакого boxed-скроллера.
   * Запертый скроллер `.swipes-feed-lock` — только у ленты с колодой.
   */
  const isContentTab = computed(() => activeTab.value !== 'feed')

  /**
   * Вернуться из таба-роута на ленту свайпов.
   */
  function backToFeed(): void {
    if (activeTab.value === 'feed') return
    goTab('feed')
  }

  /**
   * Пол по умолчанию для фильтра «кого показать»: сохранённый выбор,
   * иначе противоположный своему (мужчина листает девушек и наоборот).
   * Сброс фильтров возвращается именно к нему, история свайпов
   * при этом не трогается.
   *
   * @returns male|female|all
   */
  function defaultGender(): string {
    const saved = authUser.value?.dating_gender_pref
    if (saved === 'male' || saved === 'female') return saved
    const own = authUser.value?.gender
    if (own === 'male') return 'female'
    if (own === 'female') return 'male'
    return 'all'
  }

  const filters = ref<SwipeFilters>({
    goal: null,
    gender: defaultGender(),
    age_min: null,
    age_max: null,
    radius_km: null,
    interests: [],
  })

  const privacy = ref({
    dating_match_only: !!authUser.value?.dating_match_only,
    dating_hide_name: !!authUser.value?.dating_hide_name,
    dating_hide_age: !!authUser.value?.dating_hide_age,
    dating_hide_distance: !!authUser.value?.dating_hide_distance,
  })

  const dragX = ref(0)
  const dragY = ref(0)
  const dragging = ref(false)
  const dragStartX = ref(0)
  const dragStartY = ref(0)
  const leaving = ref(false)
  const flyDir = ref<'like' | 'left' | 'right' | null>(null)
  const exiting = ref<{ card: SwipeCard; dir: 'like' | 'left' | 'right'; fromX: number; fromY: number } | null>(null)

  const current = computed(() => cards.value[index.value] ?? null)
  const next = computed(() => cards.value[index.value + 1] ?? null)
  /**
   * Ключ верхней карточки для полного перемонтирования при смене человека.
   *
   * Лайк/пас меняют `current` — без ключа Vue переиспользует DOM колоды
   * (фото, точки-кадры, инфо), и в WebView Mini App кадр предыдущего
   * человека мог висеть поверх нового. С ключом новый человек = новое
   * поддерево: фото, индекс кадра и данные всегда его собственные.
   */
  const cardKey = computed(() => `swipe-card-${current.value?.id ?? 'none'}`)
  const hasMore = computed(() => index.value < cards.value.length)
  const seenCount = computed(() => Math.min(index.value, cards.value.length))
  const favoritesCount = computed(() => favorites.value.length)

  /**
   * Есть ли активные фильтры ленты.
   *
   * Пол сравниваем с дефолтом (противоположный своему),
   * а не с «Все»: дефолтный пол фильтром не считается.
   *
   * @returns true если хоть один фильтр задан
   */
  const hasActiveFilters = computed(() => {
    const f = filters.value
    return !!(f.goal || (f.gender && f.gender !== defaultGender()) || f.age_min || f.age_max || f.radius_km || (f.interests && f.interests.length))
  })

  /**
   * Лента исчерпана: все загруженные карточки просмотрены.
   *
   * Колода хранит просмотренные (индекс в конце), поэтому пустого
   * массива недостаточно — проверяем и положение индекса.
   *
   * @returns true когда всех просвайпали
   */
  const feedExhausted = computed(() => !loading.value && !error.value && !current.value && (cards.value.length === 0 || index.value >= cards.value.length))

  const quotaLabel = computed(() => {
    if (!quota.value) return ''
    if (quota.value.limit < 0) return 'Безлимит'
    return `Осталось сообщений: ${quota.value.left} из ${quota.value.limit}`
  })

  /**
   * Срок действующего тарифа для PRO-таба.
   *
   * Дата приходит из квоты бэка (по ней же считаются лимиты),
   * поэтому подпись всегда согласуется с лимитами.
   *
   * @returns «до 12.10.2026», «без срока» или пусто для Free
   */
  const planExpiresLabel = computed(() => {
    const plan = quota.value?.plan ?? ''
    if (plan !== 'pro' && plan !== 'premium' && plan !== 'business') return ''
    const raw = quota.value?.plan_expires_at
    if (!raw) return 'без срока'
    try {
      const date = new Date(raw).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
      return `до ${date}`
    } catch {
      return ''
    }
  })

  /** Лимит радиуса по тарифу. Null — безлимит (PRO). */
  const radiusLimit = computed(() => quota.value?.radius_limit ?? FREE_SWIPES_RADIUS_KM)

  /** Доступен ли сброс истории (стафф и PRO/Premium/Business — всегда, Free — один раз). */
  const canResetHistory = computed(() => quota.value?.can_reset ?? isStaff.value)

  /**
   * Подсказка кнопки сброса просмотренных по тарифу.
   *
   * @returns текст для title кнопки
   */
  const resetTitle = computed(() => {
    if (isStaff.value) {
      return 'Сбросить просмотренные (Premium — безлимит)'
    }

    if (isPremium.value) {
      return 'Сбросить просмотренные (Premium — безлимит)'
    }

    if (isPro.value) {
      return 'Сбросить просмотренные (PRO — безлимит)'
    }

    return 'Сбросить просмотренные (1 раз)'
  })

  /**
   * Пояснение сброса в PRO-блоке: у PRO/Premium сброс бесконечный, у Free одноразовый.
   *
   * @returns текст описания сброса
   */
  const resetDescription = computed(() => {
    if (isStaff.value || isPremium.value) {
      return 'Premium: сброс безлимитный — листай заново когда угодно'
    }

    if (isPro.value) {
      return 'PRO: сброс безлимитный — листай заново когда угодно'
    }

    if (canResetHistory.value) {
      return 'Вернёт всех просвайпанных в ленту'
    }

    return 'Одноразовый сброс уже использован'
  })

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

  /** Дефолт экстра-состояния до первой квоты с бэка. */
  const emptyExtras: SwipeExtras = {
    superlikes_left: 0,
    superlikes_daily: 1,
    superlike_balance: 0,
    boosts_balance: 0,
    boost_active: false,
    boost_until: null,
    undos_left: 0,
    can_undo: false,
  }

  /** Разовые товары: суперлайки, буст, откаты (из quotaState). */
  const extras = computed<SwipeExtras>(() => quota.value?.extras ?? emptyExtras)

  /** Остаток суперлайков. <0 — безлимит (админ). */
  const superlikesLeft = computed(() => extras.value.superlikes_left)

  /** Остаток откатов в день. <0 — безлимит (PRO). */
  const undosLeft = computed(() => extras.value.undos_left)

  /** Можно ли откатить: есть свежий свайп в ленте и лимит. */
  const canUndo = computed(() => {
    if (!lastSwiped.value || acting.value || leaving.value) return false
    if (!extras.value.can_undo) return false
    return extras.value.undos_left !== 0
  })

  /**
   * Подпись остатка для бейджа: число или ∞.
   * @param left остаток (<0 — безлимит)
   * @returns текст бейджа
   */
  function leftLabel(left: number): string {
    return left < 0 ? '∞' : String(left)
  }

  /** Активен ли буст моего профиля прямо сейчас. */
  const boostActive = computed(() => extras.value.boost_active)

  /**
   * Подпись конца буста для баннера.
   * @returns «до 21:40» или пусто
   */
  const boostUntilLabel = computed(() => {
    const raw = extras.value.boost_until
    if (!raw) return ''
    try {
      const time = new Date(raw).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      return `до ${time}`
    } catch {
      return ''
    }
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
   * Свайп-жест нейтральный (просто листание), штампы скрыты:
   * всегда 0, лайк ставится только кнопкой.
   *
   * @returns доля проявления (всегда 0)
   */
  const likeStrength = computed(() => 0)

  /**
   * Сила штампа паса 0..1.
   *
   * Свайп-жест нейтральный (просто листание), штампы скрыты:
   * всегда 0, пас отдельным действием больше не отправляется.
   *
   * @returns доля проявления (всегда 0)
   */
  const passStrength = computed(() => 0)

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
   *
   * Мэтч показываем сплэшем синхронно у обеих сторон: событие
   * match.created летит обоим участникам (сокет и поллер несут
   * одинаковый пейлоад user_a/user_b), поэтому пассивная сторона
   * тоже поднимает окно мэтча, а не только обновляет списки.
   *
   * Слушаем только канонические user:* события: сокет (useUserChannel)
   * эмитит только их, а поллер дублирует каждое событие парой
   * notify:* + user:* — подписка на обе ветки давала двойной рефетч.
   * @returns функция отписки
   */
  /**
   * Поднять окно мэтча из входящего события match.created.
   *
   * Пейлоад одинаковый у сокета и поллера: match_id, conversation_id,
   * user_a/user_b {id, name, avatar_url}. Свою сторону определяем
   * по auth.user.id, чужую показываем в сплэше. Уже открытый мэтч
   * с тем же чатом не трогаем (актор выставил его из ответа act).
   *
   * @param payload событие match.created
   */
  function showMatchFromEvent(payload?: any): void {
    const convId = Number(payload?.conversation_id ?? 0) || null
    if (!convId) {
      return
    }
    if (matchedConversationId.value === convId) {
      return
    }
    let mine = 0
    try {
      mine = Number((usePage().props.auth as any)?.user?.id ?? 0)
    } catch {
      mine = 0
    }
    const a = payload?.user_a ?? null
    const b = payload?.user_b ?? null
    const other = a && b ? (Number(a.id) === mine ? b : a) : (payload?.user ?? null)
    if (!other || Number(other?.id) <= 0) {
      return
    }
    const avatar = other.avatar_url ? String(other.avatar_url) : null
    matchedCard.value = {
      id: Number(other.id),
      name: String(other.name ?? 'Мэтч'),
      is_anonymous: false,
      age: null,
      age_hidden: true,
      gender: null,
      bio: null,
      avatar_url: avatar,
      photos: avatar ? [avatar] : [],
      city: null,
      distance_km: null,
      distance_hidden: true,
      goal: null,
      custom_goal: null,
      about: null,
      interests: [],
      last_seen_at: null,
      is_match: true,
      liked_me: true,
    }
    matchedConversationId.value = convId
  }

  function subscribeRealtime(): () => void {
    try {
      const offs: Array<() => void> = []
      const onMatch = (payload?: any) => {
        void loadMatches()
        void loadFavorites()
        try {
          showMatchFromEvent(payload)
        } catch {
        }
      }
      const onLiked = () => {
        void loadFeed()
        void loadAdmirers()
      }
      ensureUserChannel()
      offs.push(busOn('user:match.created', (payload?: any) => onMatch(payload)))
      offs.push(busOn('user:swipe.liked', () => onLiked()))
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
   * Стабильный ключ поклонника для v-for и дедупа подгрузки.
   * У «Тайного поклонника» id скрыт (null) — ключ по времени лайка.
   *
   * @param a карточка поклонника
   * @returns уникальный ключ строки
   */
  function admirerKey(a: { id: number | null; is_incognito?: boolean; created_at?: string }): string {
    if (a.is_incognito) {
      return `inc-${a.created_at ?? 'unknown'}`
    }
    return `open-${a.id ?? 'unknown'}`
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
      const known = new Set(admirers.value.map((a) => admirerKey(a)))
      const fresh = rows.filter((a) => !known.has(admirerKey(a)))
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
   * @param userId id пользователя (null невозможен — в избранном только открытые)
   * @returns void
   */
  async function removeFavorite(userId: number | null): Promise<void> {
    if (userId == null) return
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
   * Сбросить фильтры к значениям по умолчанию.
   *
   * Пол возвращается к дефолту (сохранённый выбор, иначе
   * противоположный своему), остальное — в нейтраль.
   * История свайпов не трогается: просмотренные в ленту
   * не возвращаются, для этого есть отдельная одноразовая
   * (Free) кнопка сброса истории.
   *
   * @returns void
   */
  async function resetFilters(): Promise<void> {
    filters.value = {
      goal: null,
      gender: defaultGender(),
      age_min: null,
      age_max: null,
      radius_km: null,
      interests: [],
    }
    await loadFeed()
  }

  /**
   * Полистать дальше с оценкой «пропуск»: пишет pass на бэк и уводит карту.
   *
   * Пропущенные не возвращаются в ленту до сброса истории —
   * ни сброс фильтров, ни перезаход их не вернут. Жест влево —
   * тоже пропуск; жест вправо — лайк через `swipe('like')`.
   *
   * Улёт ждём только когда анимации включены: при `motion-off`
   * keyframes убиты kill-switch за 0.01мс, а 360мс ожидания
   * превратились бы в мёртвый фриз на каждый свайп.
   *
   * @param dir направление улёта, по умолчанию вправо
   * @returns void
   *
   * @example
   * await skip('left')
   */
  async function skip(dir: 'left' | 'right' = 'right'): Promise<void> {
    const card = current.value
    if (!card || acting.value || leaving.value) return
    acting.value = true
    actingId.value = card.id
    actingAction.value = 'pass'
    leaving.value = true
    flyDir.value = dir
    exiting.value = { card, dir, fromX: dragX.value, fromY: dragY.value }
    dragging.value = false
    dragX.value = 0
    dragY.value = 0
    error.value = null
    try {
      const pending = card.id == null
        ? Promise.resolve(null)
        : datingApi.act(card.id, 'pass', false).catch(() => null)
      await waitFrame(shouldSkipMotion() ? 30 : 360)
      const res = await pending
      if (res?.quota) quota.value = res.quota
      if (res) rewards.applyReward(res)
      lastSwiped.value = { card, action: 'pass' }
      index.value += 1
      if (index.value >= cards.value.length - 3) {
        void loadMore()
      }
    } finally {
      exiting.value = null
      leaving.value = false
      flyDir.value = null
      acting.value = false
      actingId.value = null
      actingAction.value = null
    }
  }

  /**
   * Отправить суперлайк текущей карточке: усиленный лайк с улётом.
   *
   * Тратит дневной запас (Free — 1/день, PRO — 5/день) или купленный баланс.
   * Получатель видит синюю звезду в уведомлении и в «Лайки мне»,
   * автор поднимается в его ленте. Лимит избранного не блокирует.
   *
   * @returns void
   */
  async function superlike(): Promise<void> {
    const card = current.value
    if (!card || card.id == null || acting.value || leaving.value) return
    if (!ensureCanLike()) return
    if (superlikesLeft.value === 0) {
      error.value = 'Суперлайки кончились — докупи пак во вкладке PRO или дождись завтра.'
      return
    }
    acting.value = true
    actingId.value = card.id
    actingAction.value = 'superlike'
    leaving.value = true
    flyDir.value = 'like'
    exiting.value = { card, dir: 'like', fromX: dragX.value, fromY: dragY.value }
    dragging.value = false
    dragX.value = 0
    dragY.value = 0
    error.value = null
    try {
      const useIncognito = incognitoLike.value && canIncognito.value
      const pending = datingApi.act(card.id, 'like', useIncognito, true)
      await waitFrame(shouldSkipMotion() ? 30 : 360)
      const res = await pending
      quota.value = res.quota
      rewards.applyReward(res)
      if (res.matched) {
        matchedCard.value = card
        matchedConversationId.value = res.conversation_id
        await loadMatches()
      }
      lastSwiped.value = { card, action: 'superlike' }
      index.value += 1
      void loadFavorites()
      try { pokeRealtime() } catch {}
      if (index.value >= cards.value.length - 3) {
        void loadMore()
      }
    } catch (e: unknown) {
      if (handleGate(e)) return
      if (handleEmailGate(e)) return
      const err = e as { response?: { data?: { message?: string; quota?: SwipeQuota } } }
      if (err.response?.data?.quota) quota.value = err.response?.data?.quota as SwipeQuota
      error.value = err.response?.data?.message ?? 'Не удалось отправить суперлайк'
    } finally {
      exiting.value = null
      leaving.value = false
      flyDir.value = null
      acting.value = false
      actingId.value = null
      actingAction.value = null
    }
  }

  /**
   * Откатить последний свайп в ленте: анкета вернётся наверх колоды.
   *
   * Откатывается только свежий свайп (сверка по id на бэке).
   * Мэтч от этого лайка растворится, чат останется.
   * Free — 1 откат в день, PRO — безлимит.
   *
   * @returns void
   */
  async function undoLast(): Promise<void> {
    const target = lastSwiped.value
    if (!target || target.card.id == null || acting.value || leaving.value) return
    acting.value = true
    actingId.value = target.card.id
    error.value = null
    try {
      const res = await datingApi.undo(target.card.id)
      quota.value = res.quota
      cards.value.splice(index.value, 0, res.card)
      lastSwiped.value = null
      if (target.action !== 'pass') void loadFavorites()
      void loadAdmirers()
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string; quota?: SwipeQuota } } }
      if (err.response?.data?.quota) quota.value = err.response?.data?.quota as SwipeQuota
      error.value = err.response?.data?.message ?? 'Не удалось откатить свайп'
    } finally {
      acting.value = false
      actingId.value = null
    }
  }

  /**
   * Включить буст профиля на 30 минут: анкета летит первой в чужих лентах.
   *
   * PRO — один бесплатный в месяц, остальные — за купленные кредиты.
   *
   * @returns void
   */
  async function activateBoost(): Promise<void> {
    if (acting.value || buyingExtras.value) return
    buyingExtras.value = true
    error.value = null
    try {
      const res = await datingApi.boost()
      quota.value = res.quota
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { status?: number; data?: { message?: string; quota?: SwipeQuota } } }
      if (err.response?.data?.quota) quota.value = err.response?.data?.quota as SwipeQuota
      if (err.response?.status === 402 || err.response?.status === 409) {
        error.value = err.response?.data?.message ?? 'Буст недоступен'
        return
      }
      error.value = err.response?.data?.message ?? 'Не удалось включить буст'
    } finally {
      buyingExtras.value = false
    }
  }

  /**
   * Купить разовый товар (стаб оплаты: начисляет сразу, шлюз подключится сюда).
   *
   * @param item superlike_pack (+5) или boost (+1)
   * @returns void
   */
  async function purchaseExtras(item: 'superlike_pack' | 'boost'): Promise<void> {
    if (buyingExtras.value) return
    buyingExtras.value = true
    error.value = null
    try {
      const res = await datingApi.purchaseExtras(item)
      quota.value = res.quota
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string; quota?: SwipeQuota } } }
      if (err.response?.data?.quota) quota.value = err.response?.data?.quota as SwipeQuota
      error.value = err.response?.data?.message ?? 'Не удалось оформить покупку'
    } finally {
      buyingExtras.value = false
    }
  }

  /**
   * Поставить лайк текущей карточке кнопкой или жестом вправо
   * с улётом за экран и мэтч-эффектом при взаимности.
   * PRO может лайкнуть инкогнито: себя скрыть, но в уведомления попасть.
   *
   * Значение 'pass' и жест влево — это пропуск через `skip()`
   * с записью pass на бэк: анкета не вернётся до сброса истории.
   * Лайк сверх лимита избранного всё равно пишется и ждёт мэтча —
   * в избранном видны только свежие по лимиту тарифа (Free — 3).
   *
   * Улёт ждём только когда анимации включены: при `motion-off`
   * keyframes убиты kill-switch за 0.01мс, а 360мс ожидания
   * превратились бы в мёртвый фриз на каждый свайп.
   *
   * @param action like — отправить лайк; pass — пропустить с записью
   * @returns void
   */
  async function swipe(action: 'like' | 'pass'): Promise<void> {
    if (action === 'pass') {
      await skip('right')
      return
    }
    if (!ensureCanLike()) return
    const card = current.value
    if (!card || card.id == null || acting.value || leaving.value) return
    acting.value = true
    actingId.value = card.id
    actingAction.value = 'like'
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
      await waitFrame(shouldSkipMotion() ? 30 : 360)
      const res = await pending
      quota.value = res.quota
      rewards.applyReward(res)
      if (res.matched) {
        matchedCard.value = card
        matchedConversationId.value = res.conversation_id
        await loadMatches()
      }
      lastSwiped.value = { card, action: 'like' }
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
      if (handleEmailGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось отправить свайп'
    } finally {
      exiting.value = null
      leaving.value = false
      flyDir.value = null
      acting.value = false
      actingId.value = null
      actingAction.value = null
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
      const seenIds = cards.value.map((c) => c.id)
      const exclude = seenIds.filter((id): id is number => id != null).slice(-200)
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
   * @param userId id собеседника (null невозможен — мэтч всегда раскрыт)
   * @param conversationId известный id комнаты (мэтч)
   * @returns void
   */
  async function openChat(userId: number | null, conversationId?: number | null): Promise<void> {
    if (userId == null) return
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
   * @param userId id собеседника (null у инкогнито — кнопка там скрыта)
   * @returns void
   */
  async function writeWithoutMatch(userId: number | null): Promise<void> {
    if (userId == null) return
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
   * Скрытие имени/возраста/расстояния — PRO, «только мэтчи» — бесплатно.
   *
   * @param key флаг приватности
   * @param next новое значение
   */
  async function setPrivacyFlag(key: 'dating_hide_name' | 'dating_hide_age' | 'dating_hide_distance' | 'dating_match_only', next: boolean): Promise<void> {
    const needsPro = key !== 'dating_match_only'
    if (next && needsPro && !canIncognito.value) {
      const featureNames = {
        dating_hide_name: 'Скрытие имени',
        dating_hide_age: 'Скрытие возраста',
        dating_hide_distance: 'Скрытие расстояния',
      } as const
      askPremium(featureNames[key])
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
   * Конец перетаскивания: резкий сдвиг действует как в Tinder.
   * Вправо (штамп LIKE) — лайк через `swipe('like')` с мэтч-эффектом,
   * влево (штамп NOPE) — пропуск с записью pass, анкета не вернётся
   * до сброса истории.
   *
   * @returns void
   */
  async function dragEnd(): Promise<void> {
    if (!dragging.value || leaving.value) return
    dragging.value = false
    const threshold = 110
    const shiftX = dragX.value
    if (shiftX < -threshold) {
      await skip('left')
      return
    }
    if (shiftX > threshold) {
      await swipe('like')
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
   * Админ и PRO — безлимитно, Free — один раз.
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
   * Лайк в ответ из «Меня лайкнули»: взаимность сразу светит сплэш
   * сердец и увозит в чат с человеком (окно мэтча успевает показаться).
   * @param userId id пользователя (null у инкогнито — кнопка там скрыта)
   */
  async function swipeAdmirer(userId: number | null): Promise<void> {
    if (userId == null) return
    if (acting.value) return
    if (!ensureCanLike()) return
    acting.value = true
    actingId.value = userId
    error.value = null
    try {
      const res = await datingApi.act(userId, 'like', false)
      quota.value = res.quota
      rewards.applyReward(res)
      if (res.matched) {
        const peer = admirers.value.find((a) => a.id === userId) ?? null
        if (peer) {
          matchedCard.value = { ...peer }
          matchedConversationId.value = res.conversation_id
        }
        await loadMatches()
        await loadAdmirers()
        if (matchedCard.value && res.conversation_id) {
          await waitFrame(shouldSkipMotion() ? 300 : 1600)
          if (matchedCard.value && matchedConversationId.value === res.conversation_id) {
            await openChat(userId, res.conversation_id)
          }
        }
      }
      cards.value = cards.value.filter((c) => c.id !== userId)
      admirers.value = admirers.value.map((a) => (a.id === userId ? { ...a, is_match: true } : a))
    } catch (e: unknown) {
      if (handleGate(e)) return
      if (handleEmailGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось отправить лайк'
    } finally {
      acting.value = false
      actingId.value = null
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
    cardKey,
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
    admirerKey,
    incognitoLike,
    canIncognito,
    isPro,
    isPremium,
    isStaff,
    resetTitle,
    resetDescription,
    planLabel,
    activeTab,
    goTab,
    showTabBack,
    isContentTab,
    backToFeed,
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
    planExpiresLabel,
    isQuotaEmpty,
    extras,
    superlikesLeft,
    undosLeft,
    canUndo,
    leftLabel,
    boostActive,
    boostUntilLabel,
    buyingExtras,
    lastSwiped,
    radiusLimit,
    canResetHistory,
    isRadiusPro,
    filters,
    privacy,
    ageMinText,
    ageMaxText,
    loading,
    acting,
    actingId,
    actingAction,
    creatingChat,
    ageGate,
    ageGateReason,
    needsEmailVerification,
    isEmailVerified,
    canLike,
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
    superlike,
    undoLast,
    activateBoost,
    purchaseExtras,
    skip,
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
