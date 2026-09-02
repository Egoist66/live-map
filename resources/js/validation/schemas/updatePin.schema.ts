import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const updatePinSchema = toTypedSchema(
  z.object({
    title: z.string().min(1, 'Заголовок обязателен').max(100),
    body: z.string().max(1000).optional().nullable(),
    category: z.enum(['question', 'announcement', 'warning', 'event', 'offer', 'help']),
  }),
)
