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
] as const

export type SignupGoal = (typeof SIGNUP_GOALS)[number]['value']

/**
 * Цель захода: опции селекта и проверка «вести в ULove».
 * @returns опции целей и предикат любовной цели
 * @example const g = useSignupGoals(); g.isLoveGoal('love')
 */
export function useSignupGoals() {
  const options = [...SIGNUP_GOALS]

  const isLoveGoal = (goal: string | null | undefined): boolean => {
    return goal !== 'neighbors' && goal != null && goal !== ''
  }

  return { options, isLoveGoal }
}
