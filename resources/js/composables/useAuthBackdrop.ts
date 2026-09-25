import { computed } from 'vue'

/**
 * Тема анимированного фона страниц входа и регистрации.
 */
export type AuthBackdropTheme = 'ulove'

/**
 * Паттерн декора поверх градиента: всегда сердца ULove.
 */
export type AuthBackdropPattern = 'hearts'

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
  /** Тематическая рамка стеклянной карточки (полные строки для JIT) */
  cardClass: string
}

/**
 * Токены фона для Login/Register: всегда ULove.
 *
 * Логика выбора убрана, отрисовка — в `AuthBackdrop.vue`
 * (Правило №1): ненавязчивое розовое утро с медленно
 * всплывающими сердцами, одинаковое на входе и регистрации —
 * поэтому переход между формами ровный, без смены фона.
 *
 * @returns токены фона ULove
 * @example
 * ```ts
 * const backdrop = useAuthBackdrop()
 * // backdrop.tokens.value.pattern === 'hearts'
 * ```
 */
export function useAuthBackdrop() {
  const theme = computed<AuthBackdropTheme>(() => 'ulove')

  const tokens = computed<AuthBackdropTokens>(() => ({
    theme: 'ulove' as AuthBackdropTheme,
    skyClass: 'bg-gradient-to-b from-rose-50 via-pink-50 to-surface',
    skyDarkClass: 'dark:from-[#1D1016] dark:via-[#191019] dark:to-[#0F121F]',
    blobAClass: 'bg-gradient-to-br from-rose-300/60 to-fuchsia-300/50 dark:from-rose-600/20 dark:to-fuchsia-700/15',
    blobBClass: 'bg-gradient-to-tr from-orange-200/60 to-rose-200/50 dark:from-orange-500/10 dark:to-rose-600/10',
    pattern: 'hearts' as AuthBackdropPattern,
    cardClass:
      '!border-rose-200/80 dark:!border-rose-400/20 dark:!shadow-[0_0_70px_-18px_rgba(244,63,94,0.45)] shadow-[0_24px_70px_-24px_rgba(244,63,94,0.5)]',
  }))

  return { theme, tokens }
}
