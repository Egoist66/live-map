import { z } from 'zod'
import { toTypedSchema } from '@vee-validate/zod'

export const CODE_KINDS = [
  { v: 'pin4', l: 'PIN · 4 цифры', d: 'быстро и просто' },
  { v: 'alpha8', l: 'Пароль · 8 символов', d: 'латиница + цифры' },
] as const

export type LockKind = 'pin4' | 'alpha8'

function codeMessage(kind: string): string {
  return kind === 'alpha8' ? 'Пароль — ровно 8 символов: латиница и цифры' : 'PIN — ровно 4 цифры'
}

export function isCodeValid(kind: string, code: string): boolean {
  return kind === 'alpha8' ? /^[A-Za-z0-9]{8}$/.test(code) : /^\d{4}$/.test(code)
}

export const screenLockSetupSchema = toTypedSchema(
  z
    .object({
      kind: z.enum(['pin4', 'alpha8']),
      code: z.string(),
      confirm: z.string(),
      timeout: z.number().refine((v) => [1, 5, 10].includes(v), 'Выбери 1, 5 или 10 минут'),
    })
    .superRefine((d, ctx) => {
      if (!isCodeValid(d.kind, d.code)) {
        ctx.addIssue({ code: 'custom', path: ['code'], message: codeMessage(d.kind) })
      }
      if (d.code !== d.confirm) {
        ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'Коды не совпадают' })
      }
    }),
)

export const screenLockUnlockSchema = toTypedSchema(
  z.object({
    code: z.string().min(4).max(32),
  }),
)

export const SCREEN_LOCK_TIMEOUTS = [
  { v: 1, l: '1 минута' },
  { v: 5, l: '5 минут' },
  { v: 10, l: '10 минут' },
] as const
