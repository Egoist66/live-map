import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const createCommentSchema = toTypedSchema(
  z.object({
    content: z.string().min(1, 'Комментарий пустой').max(1000, 'Максимум 1000 символов'),
  }),
)
