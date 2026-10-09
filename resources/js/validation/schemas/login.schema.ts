import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const loginSchema = toTypedSchema(
  z.object({
    email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
    password: z.string().min(1, 'Пароль обязателен').min(6, 'Минимум 6 символов'),
  }),
)

export type LoginFormValues = z.infer<ReturnType<typeof z.object>>
