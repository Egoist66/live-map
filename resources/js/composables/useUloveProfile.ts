import { computed, ref } from 'vue'
import { datingApi } from '@/services/dating.api'
import { planOf } from '@/composables/usePlanLimits'

const GOAL_LABELS: Record<string, string> = {
  love: 'Отношения',
  flirt: 'Флирт',
  friendship: 'Дружба',
  chat: 'Общение',
  interests: 'По интересам',
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Парень',
  female: 'Девушка',
  other: 'Пол не указан',
}

/**
 * Один факт анкеты для структурированной сетки (подпись + иконка + текст).
 */
export interface UloveFactItem {
  /** подпись плитки («Пол», «Цель», «Город») */
  label: string
  /** иконка primeicons */
  icon: string
  /** текст факта */
  text: string
}

/**
 * Модель Tinder-профиля: данные из анкеты ULove + регистрации.
 *
 * Имя, возраст, пол, город — со старта регистрации;
 * цель, «о себе», интересы — из анкеты дейтинга.
 * Тарифные опции (PRO-бейдж, скрытия) показывает по факту тарифа.
 *
 * @param profileUser геттер profileUser со страницы профиля
 * @returns строки профиля, тариф и действие «Лайк»
 * @example const p = useUloveProfile(() => props.profileUser)
 */
export function useUloveProfile(profileUser: () => any) {
  const liking = ref(false)
  const liked = ref(false)
  const likeError = ref<string | null>(null)
  const matched = ref(false)
  const matchedConversationId = ref<number | null>(null)

  const user = computed(() => profileUser() ?? {})

  const name = computed(() => {
    if (user.value.dating_hide_name) {
      return 'Анкета скрыта'
    }

    return String(user.value.name ?? 'Без имени')
  })

  const age = computed(() => {
    if (user.value.dating_hide_age) {
      return null
    }

    const raw = user.value.age

    return typeof raw === 'number' && raw > 0 ? String(raw) : null
  })

  const goal = computed(() => {
    const custom = String(user.value.dating_custom_goal ?? '').trim()

    if (custom) {
      return custom
    }

    return GOAL_LABELS[String(user.value.dating_goal ?? '')] ?? null
  })

  const about = computed(() => {
    const dating = String(user.value.dating_about ?? '').trim()

    if (dating) {
      return dating
    }

    return String(user.value.bio ?? '').trim() || null
  })

  const interests = computed<string[]>(() => {
    const raw = user.value.dating_interests

    if (!Array.isArray(raw)) {
      return []
    }

    return raw.map((tag) => String(tag)).filter((tag) => tag !== '')
  })

  const genderLabel = computed(() => GENDER_LABELS[String(user.value.gender ?? '')] ?? null)

  const cityLine = computed(() => {
    const parts = [user.value.home_city, user.value.country].map((part) => String(part ?? '').trim()).filter((part) => part !== '')

    return parts.length ? parts.join(', ') : null
  })

  const plan = computed(() => String(planOf(user.value) ?? 'free'))

  const isPro = computed(() => plan.value === 'pro' || plan.value === 'business')

  /**
   * Факты анкеты тиндер-строкой: возраст, пол, цель, город.
   * Пустые значения пропускаются — нет цели, нет и факта.
   */
  const factItems = computed<UloveFactItem[]>(() => {
    const items: UloveFactItem[] = []

    const ageText = age.value
    if (ageText) {
      items.push({ label: 'Возраст', icon: 'pi pi-gift', text: ageText })
    }

    const gender = genderLabel.value
    if (gender) {
      items.push({ label: 'Пол', icon: 'pi pi-user', text: gender })
    }

    const goalText = goal.value
    if (goalText) {
      items.push({ label: 'Цель', icon: 'pi pi-heart', text: goalText })
    }

    const city = cityLine.value
    if (city) {
      items.push({ label: 'Город', icon: 'pi pi-map-marker', text: city })
    }

    return items
  })

  const datingEnabled = computed(() => user.value.dating_enabled !== false)

  /**
   * Лайкнуть человека из его профиля (вне колоды свайпов).
   *
   * Ответ бэка не выбрасываем: при взаимности там matched=true
   * и conversation_id — поднимаем локальный флаг мэтча, чтобы
   * шаблон показал «Мэтч! Открыть чат». Получателю бэк шлёт
   * swipe.liked / match.created сам (сокет + поллер + пуш).
   *
   * @param userId id пользователя
   */
  async function like(userId: number | null): Promise<void> {
    if (!userId || liking.value || liked.value) {
      return
    }

    liking.value = true
    likeError.value = null

    try {
      const res = await datingApi.act(userId, 'like', false)
      liked.value = true
      try {
        const { pokeRealtime } = await import('@/composables/useRealtimePoller')
        pokeRealtime()
      } catch {
      }
      if (res?.matched) {
        matched.value = true
        matchedConversationId.value = Number(res.conversation_id ?? 0) || null
      }
    } catch (err: any) {
      likeError.value = err?.response?.data?.message ?? 'Не получилось поставить лайк'
    } finally {
      liking.value = false
    }
  }

  return {
    name,
    age,
    goal,
    about,
    interests,
    genderLabel,
    cityLine,
    factItems,
    plan,
    isPro,
    datingEnabled,
    liking,
    liked,
    likeError,
    matched,
    matchedConversationId,
    like,
  }
}
