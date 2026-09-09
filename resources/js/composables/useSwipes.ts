import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { datingApi } from '@/services/dating.api'
import type { SwipeCard, SwipeFilters, SwipeQuota } from '@/services/dating.api'

/**
 * Дейтинг-лента: свайпы, мэтчи, фильтры, квоты, приватность.
 *
 * Компонент только отображает состояние хука.
 *
 * @returns состояние ленты и действия свайпов
 */
export function useSwipes() {
  const cards = ref<SwipeCard[]>([])
  const index = ref(0)
  const matches = ref<Array<{ match_id: number; conversation_id: number | null; user: { id: number; name: string; avatar_url: string | null } }>>([])
  const quota = ref<SwipeQuota | null>(null)
  const loading = ref(false)
  const acting = ref(false)
  const error = ref<string | null>(null)
  const showFilters = ref(false)
  const matchedCard = ref<SwipeCard | null>(null)
  const matchedConversationId = ref<number | null>(null)
  const creatingChat = ref(false)
  const ageGate = ref(false)
  const ageGateReason = ref<'missing' | 'underage'>('missing')
  const birthDate = ref<Date | null>(null)
  const verifying = ref(false)

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
  const dragging = ref(false)
  const dragStartX = ref(0)

  const current = computed(() => cards.value[index.value] ?? null)
  const hasMore = computed(() => index.value < cards.value.length)
  const seenCount = computed(() => Math.min(index.value, cards.value.length))

  const quotaLabel = computed(() => {    if (!quota.value) return ''
    if (quota.value.limit < 0) return 'Безлимит'
    return `Сообщения: ${quota.value.left}/${quota.value.limit}`
  })

  const isQuotaEmpty = computed(() => {
    if (!quota.value) return false
    if (quota.value.limit < 0) return false
    return quota.value.left <= 0
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
   * Загрузить ленту кандидатов.
   *
   * @returns void
   */
  async function loadFeed(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await datingApi.feed(filters.value)
      cards.value = res.cards
      quota.value = res.quota
      index.value = 0
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось загрузить ленту'
    } finally {
      loading.value = false
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
   * Отправить свайп за текущую карточку.
   *
   * @param action like|pass
   * @returns void
   */
  async function swipe(action: 'like' | 'pass'): Promise<void> {
    const card = current.value
    if (!card || acting.value) return
    acting.value = true
    error.value = null
    dragX.value = 0
    try {
      const res = await datingApi.act(card.id, action)
      quota.value = res.quota
      if (res.matched) {
        matchedCard.value = card
        matchedConversationId.value = res.conversation_id
        await loadMatches()
      }
      index.value += 1
      if (index.value >= cards.value.length - 3) {
        void loadMore()
      }
    } catch (e: unknown) {
      if (handleGate(e)) return
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось отправить свайп'
    } finally {
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
   * @returns void
   */
  function dragStart(clientX: number): void {
    dragging.value = true
    dragStartX.value = clientX
  }

  /**
   * Движение перетаскивания.
   *
   * @param clientX координата X
   * @returns void
   */
  function dragMove(clientX: number): void {
    if (!dragging.value) return
    dragX.value = clientX - dragStartX.value
  }

  /**
   * Конец перетаскивания: резкий сдвиг = свайп.
   *
   * @returns void
   */
  async function dragEnd(): Promise<void> {
    if (!dragging.value) return
    dragging.value = false
    const threshold = 110
    const x = dragX.value
    dragX.value = 0
    if (x > threshold) await swipe('like')
    if (x < -threshold) await swipe('pass')
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
    hasMore,
    seenCount,
    matches,
    quota,
    quotaLabel,
    isQuotaEmpty,
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
    adultMaxDate,
    verifyAge,
    error,
    showFilters,
    matchedCard,
    matchedConversationId,
    dragX,
    dragging,
    goalLabel,
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
