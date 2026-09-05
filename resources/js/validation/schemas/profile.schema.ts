import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

const toNull = (v: unknown) => (v === '' || v === undefined ? null : v)
const toNumberOrNull = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'number') return v
  const s = String(v).replace(',', '.').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isNaN(n) ? v : n
}

const MAX_BY_PLAN: Record<string, number> = { free: 1, pro: 5, business: 50 }

export const updateProfileSchema = toTypedSchema(
  z
    .object({
      name: z.string().min(1, 'Имя обязательно').max(255),
      gender: z.enum(['male', 'female', 'other']).nullable().optional(),
      email: z.string().email('Некорректный email'),
      home_lat: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Широта должна быть числом' }).min(-90, 'Минимум -90').max(90, 'Максимум 90').nullable().optional()),
      home_lng: z.preprocess(toNumberOrNull, z.number({ invalid_type_error: 'Долгота должна быть числом' }).min(-180, 'Минимум -180').max(180, 'Максимум 180').nullable().optional()),
      home_radius_km: z.preprocess(toNull, z.preprocess((v: unknown) => (v === null ? v : Number(String(v).replace(',', '.'))), z.number({ invalid_type_error: 'Радиус должен быть числом' }).int('Целое число').min(1, 'Минимум 1 км').max(50, 'Максимум 50 км').nullable().optional())),
      bio: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().max(10000, 'Слишком длинно').nullable().optional()),
      is_anonymous_default: z.boolean().optional(),
      default_location_precision: z.enum(['blur_200', 'exact', 'district', 'custom']).optional(),
      default_blur_meters: z.number().min(0).max(5000).optional(),
      plan: z.enum(['free', 'pro', 'business']).optional(),
    })
    .superRefine((d, ctx) => {
      const max = MAX_BY_PLAN[d.plan || 'free'] ?? 1
      if (d.home_radius_km != null && d.home_radius_km > max) {
        const need = max >= 50 ? 'Business' : 'Pro'
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['home_radius_km'],
          message: `Максимум ${max} км на тарифе ${(d.plan || 'free').toUpperCase()} — это радиус пина. Для ${d.home_radius_km} км нужен ${need}`,
        })
      }
    }),
)
