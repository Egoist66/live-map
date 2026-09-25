/**
 * Цель захода в приложение на регистрации.
 * Все ведут в ULove; карта с пинами — бонус после регистрации.
 */
export const SIGNUP_GOALS = [
  { label: '💘 Отношения', value: 'love' },
  { label: '🔥 Флирт', value: 'flirt' },
  { label: '🤝 Дружба', value: 'friendship' },
  { label: '💬 Общение', value: 'chat' },
  { label: '🎯 По интересам', value: 'interests' },
  { label: '📍 Соседи и карта', value: 'neighbors' },
] as const

export type SignupGoal = (typeof SIGNUP_GOALS)[number]['value']

/**
 * Пресет цели: всегда полный список, по умолчанию love.
 *
 * Механика пресета из таба лендинга убрана: старт всегда ULove,
 * карта — бонус, поэтому дропдаун не прячем и ничего не лочим.
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
 * Собирает пресет для формы регистрации: всегда полный список.
 *
 * @returns незалоченная цель love и все опции
 */
function readPreset(): SignupPreset {
  const base = [...SIGNUP_GOALS].map((goal) => ({ ...goal }))

  return { locked: false, goal: 'love', options: base }
}
