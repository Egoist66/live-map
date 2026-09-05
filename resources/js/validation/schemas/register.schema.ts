import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

const toNumberOrNull = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(',', '.').trim())
  return Number.isNaN(n) ? v : n
}

export const registerSchema = toTypedSchema(
  z
    .object({
      name: z.string().min(1, 'Имя обязательно').min(2, 'Минимум 2 символа').max(255),
      email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
      gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Выбери пол' }) }),
      password: z.string().min(8, 'Минимум 8 символов'),
      password_confirmation: z.string().min(1, 'Подтвердите пароль'),
      home_lat: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Широта должна быть числом' }).min(-90).max(90).nullable().optional()),
      home_lng: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Долгота должна быть числом' }).min(-180).max(180).nullable().optional()),
      home_radius_km: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Радиус должен быть числом' }).int().min(1, 'Минимум 1 км').max(5, 'На старте Free — максимум 5 км (как радиус пина)').nullable().optional()),
      home_address: z.string().optional(),
    })
    .refine((d) => d.password === d.password_confirmation, { message: 'Пароли не совпадают', path: ['password_confirmation'] }),
)
