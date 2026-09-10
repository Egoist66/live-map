import { z } from 'zod'

const emptyToNull = (v: unknown) => {
  if (v === '' || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

/**
 * Анкета ULove: цель (пресет или своя), о себе, интересы.
 * Свои тексты проходят модерацию на бэке (политика, 18+, мат и т.д.).
 */
export const datingQuestionnaireSchema = z.object({
  dating_enabled: z.boolean().optional(),
  dating_goal: z.enum(['love', 'flirt', 'friendship', 'chat', 'interests']).nullable().optional(),
  dating_custom_goal: z.preprocess(
    emptyToNull,
    z.string().max(60, 'Максимум 60 символов').nullable().optional(),
  ),
  dating_about: z.preprocess(
    emptyToNull,
    z.string().max(1000, 'Максимум 1000 символов').nullable().optional(),
  ),
  dating_interests: z
    .array(z.string().max(40, 'Тег максимум 40 символов'))
    .max(10, 'Максимум 10 интересов')
    .optional()
    .default([]),
})

export type DatingQuestionnaire = z.infer<typeof datingQuestionnaireSchema>

/** Пресеты интересов для быстрого выбора. */
export const DATING_INTEREST_PRESETS = [
  'музыка',
  'спорт',
  'кино',
  'путешествия',
  'игры',
  'еда',
  'книги',
  'танцы',
] as const

/** Пресеты цели «что ищу». */
export const DATING_GOAL_PRESETS = [
  { label: 'Отношения', value: 'love' },
  { label: 'Флирт', value: 'flirt' },
  { label: 'Дружба', value: 'friendship' },
  { label: 'Общение', value: 'chat' },
  { label: 'По интересам', value: 'interests' },
] as const
