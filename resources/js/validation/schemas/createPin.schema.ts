import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const createPinSchema = toTypedSchema(
  z.object({
    title: z.string().min(1, 'Заголовок обязателен').max(100, 'Максимум 100 символов'),
    body: z.string().max(1000, 'Максимум 1000').optional().nullable(),
    promo: z.string().max(140, 'Максимум 140 символов').optional().nullable(),
    category: z.string().min(2).max(32).regex(/^[a-z0-9_]+$/i, 'Категория: латиница, цифры и _'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    location_precision: z.enum(['blur_200', 'exact', 'district', 'custom']).optional(),
    blur_meters: z.number().min(0).max(5000).optional(),
    is_anonymous: z.boolean().optional(),
    gender_audience: z.enum(['all', 'male', 'female']).optional(),
    radius_meters: z.number().min(500).max(50000).optional(),
    publish_at: z.string().nullable().optional(),
    district_id: z.number().int().positive().nullable().optional(),
  }),
)
