import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

const toNull = (v: unknown) => (v === '' || v === undefined ? null : v)
const toNumberOrNull = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(',', '.').trim())
  return Number.isNaN(n) ? v : n
}

const legalForms = ['ooo', 'ip', 'odo', 'zao', 'self_employed', 'craft', 'other'] as const

/**
 * Схема профиля бизнеса по законодательству РБ.
 *
 * УНП — строго 9 цифр, юрадрес обязателен для отправки на проверку
 * (сама проверка готовности — на бэке, здесь мягкие подсказки).
 */
export const businessSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, 'Название обязательно').min(2, 'Минимум 2 символа').max(255),
    brand: z.preprocess(toNull, z.string().max(255).nullable().optional()),
    category: z.preprocess(toNull, z.string().max(100).nullable().optional()),
    legal_form: z.enum(legalForms, { errorMap: () => ({ message: 'Выбери форму' }) }),
    unp: z.preprocess(
      toNull,
      z
        .string()
        .regex(/^\d{9}$/, 'УНП — 9 цифр')
        .nullable()
        .optional(),
    ),
    reg_number: z.preprocess(toNull, z.string().max(64).nullable().optional()),
    address: z.preprocess(toNull, z.string().max(255).nullable().optional()),
    legal_address: z.preprocess(toNull, z.string().max(255).nullable().optional()),
    director_name: z.preprocess(toNull, z.string().max(255).nullable().optional()),
    lat: z.preprocess(
      toNumberOrNull,
      z.number({ invalid_type_error: 'Широта — число' }).min(-90).max(90).nullable().optional(),
    ),
    lng: z.preprocess(
      toNumberOrNull,
      z.number({ invalid_type_error: 'Долгота — число' }).min(-180).max(180).nullable().optional(),
    ),
    description: z.preprocess(toNull, z.string().max(2000).nullable().optional()),
    services: z.preprocess(toNull, z.string().max(2000).nullable().optional()),
    working_hours: z.record(z.string().max(64)).nullable().optional(),
    phone: z.preprocess(toNull, z.string().max(32).nullable().optional()),
    website: z.preprocess(toNull, z.string().max(255).nullable().optional()),
  }),
)

export type BusinessLegalFormValue = (typeof legalForms)[number]
