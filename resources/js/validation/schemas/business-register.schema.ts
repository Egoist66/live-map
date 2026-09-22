import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

const toNull = (v: unknown) => (v === '' || v === undefined ? null : v)

const legalForms = ['ooo', 'ip', 'odo', 'zao', 'self_employed', 'craft', 'other'] as const

/**
 * Схема регистрации компании по законодательству РБ.
 *
 * Без дейтинга: только компания — название, форма, УНП (9 цифр),
 * юрадрес, контакты и пароль. Пол проверяется отдельным шагом.
 */
export const businessRegisterSchema = toTypedSchema(
  z
    .object({
      name: z.string().min(1, 'Название компании обязательно').min(2, 'Минимум 2 символа').max(255),
      brand: z.preprocess(toNull, z.string().max(255).nullable().optional()),
      email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
      password: z.string().min(8, 'Минимум 8 символов'),
      password_confirmation: z.string().min(1, 'Подтвердите пароль'),
      legal_form: z.enum(legalForms, { errorMap: () => ({ message: 'Выберите форму' }) }),
      unp: z.string().min(1, 'УНП обязателен').regex(/^\d{9}$/, 'УНП — строго 9 цифр'),
      legal_address: z.string().min(1, 'Юридический адрес обязателен').min(4, 'Укажите полный адрес').max(255),
      phone: z.preprocess(toNull, z.string().max(32).nullable().optional()),
      home_city: z.preprocess(toNull, z.string().max(120).nullable().optional()),
    })
    .refine((d) => d.password === d.password_confirmation, {
      message: 'Пароли не совпадают',
      path: ['password_confirmation'],
    }),
)

export type BusinessLegalFormValue = (typeof legalForms)[number]
