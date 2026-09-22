import { readLandingTab } from '@/composables/useWelcomeMode'

/**
 * Цель захода в приложение на регистрации.
 * ULove-цели ведут в свайпы, neighbors — на карту.
 */
export const SIGNUP_GOALS = [
  { label: '💘 Отношения', value: 'love' },
  { label: '🔥 Флирт', value: 'flirt' },
  { label: '🤝 Дружба', value: 'friendship' },
  { label: '💬 Общение', value: 'chat' },
  { label: '🎯 По интересам', value: 'interests' },
  { label: '📍 Соседи и карта', value: 'neighbors' },
  { label: '🏢 Бизнес', value: 'business' },
] as const

export type SignupGoal = (typeof SIGNUP_GOALS)[number]['value'] | 'business'

/**
 * Пресет цели из таба лендинга.
 *
 * UPin-таб = цель уже ясна: дропдаун прячем, шлём neighbors.
 * ULove-таб = дропдаун оставляем, но вариант «соседи» убираем.
 * Без таба — классика: полный список, по умолчанию love.
 */
export interface SignupPreset {
  locked: boolean
  goal: SignupGoal
  options: { label: string; value: string }[]
}

/**
 * Цель захода: опции селекта, проверка «вести в ULove» и пресет из таба.
 * @returns опции целей, предикат любовной цели и пресет регистрации
 * @example const g = useSignupGoals(); g.isLoveGoal('love')
 */
export function useSignupGoals() {
  const options = [...SIGNUP_GOALS]

  const isLoveGoal = (goal: string | null | undefined): boolean => {
    return goal !== 'neighbors' && goal != null && goal !== ''
  }

  const preset = readPreset()

  return { options, isLoveGoal, preset }
}

/**
 * Читает таб лендинга и собирает пресет для формы регистрации.
 *
 * @returns locked-цель и видимые опции
 */
function readPreset(): SignupPreset {
  const base = [...SIGNUP_GOALS].map((goal) => ({ ...goal }))

  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const storedChoice = window.localStorage.getItem('upin_account_choice')
      if (params.get('account') === 'business' || storedChoice === 'business') {
        return { locked: true, goal: 'business' as SignupPreset['goal'], options: base }
      }
    }
  } catch {}

  const landingTab = readLandingTab()

  if (landingTab === 'upin') {
    return { locked: true, goal: 'neighbors', options: base }
  }

  if (landingTab === 'ulove') {
    const withoutNeighbors = base.filter((goal) => goal.value !== 'neighbors' && goal.value !== 'business')
    return { locked: false, goal: 'love', options: withoutNeighbors }
  }

  return { locked: false, goal: 'love', options: base }
}
