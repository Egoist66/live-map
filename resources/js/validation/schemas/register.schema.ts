import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const registerSchema = toTypedSchema(
  z
    .object({
      name: z.string().min(1, 'Имя обязательно').min(2, 'Минимум 2 символа').max(255),
      email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
      password: z.string().min(8, 'Минимум 8 символов'),
      password_confirmation: z.string().min(1, 'Подтвердите пароль'),
      home_lat: z.number().nullable().optional(),
      home_lng: z.number().nullable().optional(),
      home_radius_km: z.number().min(1).max(10).optional(),
      home_address: z.string().optional(),
    })
    .refine((d) => d.password === d.password_confirmation, { message: 'Пароли не совпадают', path: ['password_confirmation'] }),
)
