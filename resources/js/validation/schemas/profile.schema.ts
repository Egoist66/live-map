import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const updateProfileSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, 'Имя обязательно').max(255),
    email: z.string().email('Некорректный email'),
    home_lat: z.number().nullable().optional(),
    home_lng: z.number().nullable().optional(),
    home_radius_km: z.number().min(1).max(10).optional(),
    is_anonymous_default: z.boolean().optional(),
  }),
)
