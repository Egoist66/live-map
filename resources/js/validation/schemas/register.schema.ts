import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'
import { isValidBirthDate, toIsoBirthDate } from '@/utils/birthDate'
import { CONTACT_INFO_ERROR, containsContactInfo } from '@/utils/contactInfo'

const toNumberOrNull = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(',', '.').trim())
  return Number.isNaN(n) ? v : n
}

const toBirthDate = (v: unknown) => toIsoBirthDate(v)

export const registerSchema = toTypedSchema(
  z
    .object({
      name: z
        .string()
        .min(1, 'Имя обязательно')
        .min(2, 'Минимум 2 символа')
        .max(255)
        .refine((v) => !containsContactInfo(v), CONTACT_INFO_ERROR),
      email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
      gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Выбери пол' }) }),
      password: z.string().min(8, 'Минимум 8 символов'),
      password_confirmation: z.string().min(1, 'Подтвердите пароль'),
      home_lat: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Широта должна быть числом' }).min(-90).max(90).nullable().optional()),
      home_lng: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Долгота должна быть числом' }).min(-180).max(180).nullable().optional()),
      home_radius_km: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Радиус должен быть числом' }).int().min(1, 'Минимум 1 км').max(10, 'На старте Free — максимум 10 км (как радиус пина)').nullable().optional()),
      home_address: z.string().optional(),
      home_city: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().max(120).nullable().optional()),
      country: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().max(120).nullable().optional()),
      country_code: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().max(8).nullable().optional()),
      birth_date: z.preprocess(toBirthDate, z.string().max(10).nullable().optional()).refine((v) => v == null || isValidBirthDate(v), { message: 'Некорректная дата рождения' }),
      signup_goal: z.enum(['love', 'flirt', 'friendship', 'chat', 'interests', 'neighbors', 'business'], { errorMap: () => ({ message: 'Выбери цель' }) }),
      account_type: z.enum(['person', 'business']).nullable().optional(),
    })
    .refine((d) => d.password === d.password_confirmation, { message: 'Пароли не совпадают', path: ['password_confirmation'] }),
)
