import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const createPinSchema = toTypedSchema(
  z.object({
    title: z.string().min(1, 'Заголовок обязателен').max(100, 'Максимум 100 символов'),
    body: z.string().max(1000, 'Максимум 1000').optional().nullable(),
    category: z.enum(['question', 'announcement', 'warning', 'event', 'offer', 'help']),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    location_precision: z.enum(['blur_200', 'exact', 'district', 'custom']).optional(),
    blur_meters: z.number().min(0).max(5000).optional(),
    is_anonymous: z.boolean().optional(),
    radius_meters: z.number().min(500).max(50000).optional(),
  }),
)
