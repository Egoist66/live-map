import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const updatePasswordSchema = toTypedSchema(
  z
    .object({
      current_password: z.string().min(1, 'Введите текущий пароль'),
      password: z.string().min(8, 'Минимум 8 символов'),
      password_confirmation: z.string().min(1, 'Подтвердите пароль'),
    })
    .refine((d) => d.password === d.password_confirmation, { message: 'Пароли не совпадают', path: ['password_confirmation'] }),
)
