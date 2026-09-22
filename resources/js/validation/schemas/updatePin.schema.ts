import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const updatePinSchema = toTypedSchema(
  z.object({
    title: z.string().min(1, 'Заголовок обязателен').max(100),
    body: z.string().max(1000).optional().nullable(),
    promo: z.string().max(140, 'Максимум 140 символов').optional().nullable(),
    category: z.string().min(2).max(32).regex(/^[a-z0-9_]+$/i, 'Категория: латиница, цифры и _'),
    gender_audience: z.enum(['all', 'male', 'female']).optional(),
  }),
)
