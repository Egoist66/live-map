import { computed } from 'vue'
import { useAuthTheme } from '@/composables/useAuthTheme'

/**
 * Тема анимированного фона страниц входа и регистрации.
 */
export type AuthBackdropTheme = 'ulove' | 'upin' | 'business'

/**
 * Паттерн декора поверх градиента: пины карты, деловой skyline, сердца.
 */
export type AuthBackdropPattern = 'pins' | 'skyline' | 'hearts'

/**
 * Токены фона auth-страниц под текущую тему.
 */
export interface AuthBackdropTokens {
  /** Активная тема фона */
  theme: AuthBackdropTheme
  /** Базовый градиент неба (светлая тема) */
  skyClass: string
  /** Базовый градиент неба (тёмная тема) */
  skyDarkClass: string
  /** Первый дрейфующий blob */
  blobAClass: string
  /** Второй дрейфующий blob */
  blobBClass: string
  /** Декоративный паттерн поверх */
  pattern: AuthBackdropPattern
}

/**
 * Токены тематического фона для Login/Register.
 *
 * Логика выбора — здесь, отрисовка — в `AuthBackdrop.vue`
 * (Правило №1). Темы:
 * - `upin` — ночное небо карты: сетка точек, светящиеся пины и маршрут;
 * - `business` — премиальный slate + золото: skyline баров и линия роста;
 * - `ulove` — ненавязчивое розовое утро: медленно всплывающие сердца.
 *
 * @returns токены фона под текущую auth-тему
 * @example
 * ```ts
 * const backdrop = useAuthBackdrop()
 * // backdrop.tokens.value.pattern === 'pins'
 * ```
 */
export function useAuthBackdrop() {
  const authTheme = useAuthTheme()

  const theme = computed<AuthBackdropTheme>(() => {
    if (authTheme.isBusiness.value) {
      return 'business'
    }

    if (authTheme.isUlove.value) {
      return 'ulove'
    }

    return 'upin'
  })

  const tokens = computed<AuthBackdropTokens>(() => {
    const current = theme.value

    if (current === 'business') {
      return {
        theme: current,
        skyClass: 'bg-gradient-to-b from-amber-50 via-stone-100 to-surface',
        skyDarkClass: 'dark:from-[#14101A] dark:via-[#1B1526] dark:to-[#0F121F]',
        blobAClass: 'bg-gradient-to-br from-amber-400/50 to-orange-500/40 dark:from-amber-500/25 dark:to-orange-600/20',
        blobBClass: 'bg-gradient-to-tr from-violet-500/40 to-indigo-600/30 dark:from-violet-600/20 dark:to-indigo-800/20',
        pattern: 'skyline',
      }
    }

    if (current === 'ulove') {
      return {
        theme: current,
        skyClass: 'bg-gradient-to-b from-rose-50 via-pink-50 to-surface',
        skyDarkClass: 'dark:from-[#1D1016] dark:via-[#191019] dark:to-[#0F121F]',
        blobAClass: 'bg-gradient-to-br from-rose-300/60 to-fuchsia-300/50 dark:from-rose-600/20 dark:to-fuchsia-700/15',
        blobBClass: 'bg-gradient-to-tr from-orange-200/60 to-rose-200/50 dark:from-orange-500/10 dark:to-rose-600/10',
        pattern: 'hearts',
      }
    }

    return {
      theme: current,
      skyClass: 'bg-gradient-to-b from-sky-100 via-indigo-50 to-surface',
      skyDarkClass: 'dark:from-[#0B1526] dark:via-[#101B33] dark:to-[#0F121F]',
      blobAClass: 'bg-gradient-to-br from-sky-400/50 to-blue-500/40 dark:from-sky-500/25 dark:to-blue-700/20',
      blobBClass: 'bg-gradient-to-tr from-indigo-400/40 to-teal-300/40 dark:from-indigo-600/20 dark:to-teal-500/15',
      pattern: 'pins',
    }
  })

  return { theme, tokens }
}
