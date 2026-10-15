import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

/**
 * Проверка совершеннолетия для дейтинга.
 *
 * @param value дата из DatePicker
 * @returns true когда 18+ и не будущее
 */
function isAdult(value: Date): boolean {
  const now = new Date()
  if (value.getTime() > now.getTime()) return false
  const adult = new Date(value.getFullYear() + 18, value.getMonth(), value.getDate())
  return adult.getTime() <= now.getTime()
}

export const onboardingSchema = toTypedSchema(
  z.object({
    name: z.string().min(2, 'Имя — от 2 символов').max(255, 'Слишком длинное имя'),
    gender: z.enum(['male', 'female'], { message: 'Выбери пол' }),
    birth_date: z
      .date({ message: 'Укажи дату рождения' })
      .max(new Date(), 'Дата рождения не может быть в будущем')
      .refine(isAdult, 'Свайпы и мэтчи — строго с 18 лет'),
    dating_goal: z.enum(['love', 'flirt', 'friendship', 'chat', 'interests'], {
      message: 'Выбери цель',
    }),
    home_city: z.string().max(120, 'Город — до 120 символов').nullish(),
  }),
)

export type OnboardingFormValues = {
  name: string
  gender: 'male' | 'female' | null
  birth_date: Date | null
  dating_goal: 'love' | 'flirt' | 'friendship' | 'chat' | 'interests' | null
  home_city: string | null
}
