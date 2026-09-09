import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

const titleField = z.string().min(3, 'Минимум 3 символа').max(200, 'Максимум 200 символов')

const bodyField = z
  .string()
  .max(100000, 'Максимум 100000 символов')
  .nullable()
  .optional()

const publishField = z.boolean().optional().default(false)

/**
 * Схема формы «Контакты»: реквизиты ООО обязательны.
 */
export const contactsSchema = toTypedSchema(
  z.object({
    title: titleField,
    body: z.string().max(100000, 'Максимум 100000 символов').nullable().optional(),
    company_name: z.string().min(3, 'Укажите название организации').max(200, 'Максимум 200 символов'),
    inn: z
      .string()
      .min(1, 'ИНН обязателен')
      .max(12, 'Максимум 12 цифр')
      .regex(/^\d{10}(\d{2})?$/, 'ИНН: 10 или 12 цифр'),
    ogrn: z
      .string()
      .min(1, 'ОГРН обязателен')
      .max(15, 'Максимум 15 цифр')
      .regex(/^\d{13}(\d{2})?$/, 'ОГРН: 13 или 15 цифр'),
    address: z.string().min(5, 'Укажите адрес').max(500, 'Максимум 500 символов'),
    email: z.string().min(1, 'Email обязателен').max(200, 'Максимум 200 символов').email('Некорректный email'),
    phone: z.string().min(6, 'Укажите телефон').max(50, 'Максимум 50 символов'),
    is_published: publishField,
  }),
)

/**
 * Схема формы «Политика конфиденциальности».
 */
export const privacySchema = toTypedSchema(
  z.object({
    title: titleField,
    body: z.string().min(50, 'Текст политики: минимум 50 символов').max(100000, 'Максимум 100000 символов'),
    version: z.string().max(50, 'Максимум 50 символов').nullable().optional(),
    effective_date: z.string().max(20, 'Максимум 20 символов').nullable().optional(),
    is_published: publishField,
  }),
)

/**
 * Схема формы «Публичная оферта».
 */
export const offerSchema = toTypedSchema(
  z.object({
    title: titleField,
    body: z.string().min(50, 'Текст оферты: минимум 50 символов').max(100000, 'Максимум 100000 символов'),
    version: z.string().max(50, 'Максимум 50 символов').nullable().optional(),
    effective_date: z.string().max(20, 'Максимум 20 символов').nullable().optional(),
    company_name: z.string().max(200, 'Максимум 200 символов').nullable().optional(),
    inn: z
      .string()
      .max(12, 'Максимум 12 цифр')
      .regex(/^(\d{10}(\d{2})?)?$/, 'ИНН: 10 или 12 цифр')
      .nullable()
      .optional(),
    ogrn: z
      .string()
      .max(15, 'Максимум 15 цифр')
      .regex(/^(\d{13}(\d{2})?)?$/, 'ОГРН: 13 или 15 цифр')
      .nullable()
      .optional(),
    address: z.string().max(500, 'Максимум 500 символов').nullable().optional(),
    email: z.string().max(200, 'Максимум 200 символов').email('Некорректный email').nullable().optional(),
    phone: z.string().max(50, 'Максимум 50 символов').nullable().optional(),
    is_published: publishField,
  }),
)

export const referenceSchemas = {
  contacts: contactsSchema,
  privacy: privacySchema,
  offer: offerSchema,
} as const

export type ReferenceSlug = keyof typeof referenceSchemas
