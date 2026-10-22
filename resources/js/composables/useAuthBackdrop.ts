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
 * Одно всплывающее сердечко auth-фона.
 *
 * Позиция и тайминги живут в инлайн-стилях (динамические значения
 * анимации), а цвет — в статических Tailwind-классах, чтобы JIT
 * собрал и светлую, и тёмную палитру.
 */
export interface AuthBackdropHeart {
  /** Стабильный ключ для v-for */
  id: number
  /** Цвет сердечка (светлая + тёмная тема) */
  toneClass: string
  /** Позиция и CSS-переменные анимации */
  style: Record<string, string>
}

/**
 * Раскладка поля сердечек: детерминированная (не random), чтобы
 * разметка не «дёргалась» между рендерами и не ломала гидратацию.
 */
const HEART_FIELD: ReadonlyArray<{
  left: number
  size: number
  duration: number
  delay: number
  sway: number
  opacity: number
  tone: string
}> = [
  { left: 5, size: 16, duration: 12, delay: 0.0, sway: 26, opacity: 0.55, tone: 'text-rose-400/55 dark:text-rose-400/30' },
  { left: 13, size: 30, duration: 15, delay: 2.4, sway: -32, opacity: 0.4, tone: 'text-fuchsia-400/45 dark:text-fuchsia-400/25' },
  { left: 21, size: 13, duration: 10, delay: 5.1, sway: 20, opacity: 0.5, tone: 'text-orange-300/60 dark:text-orange-300/30' },
  { left: 29, size: 40, duration: 17, delay: 1.2, sway: -40, opacity: 0.35, tone: 'text-pink-400/40 dark:text-pink-400/20' },
  { left: 37, size: 18, duration: 11, delay: 6.8, sway: 30, opacity: 0.5, tone: 'text-rose-300/55 dark:text-rose-300/25' },
  { left: 45, size: 24, duration: 14, delay: 3.6, sway: -24, opacity: 0.45, tone: 'text-violet-400/40 dark:text-violet-400/25' },
  { left: 53, size: 14, duration: 9, delay: 0.9, sway: 22, opacity: 0.55, tone: 'text-fuchsia-300/50 dark:text-fuchsia-300/25' },
  { left: 61, size: 34, duration: 16, delay: 7.4, sway: -34, opacity: 0.35, tone: 'text-rose-400/45 dark:text-rose-400/25' },
  { left: 69, size: 20, duration: 12.5, delay: 4.2, sway: 28, opacity: 0.5, tone: 'text-orange-300/55 dark:text-orange-300/25' },
  { left: 76, size: 12, duration: 10.5, delay: 2.0, sway: -18, opacity: 0.5, tone: 'text-pink-300/55 dark:text-pink-300/25' },
  { left: 83, size: 28, duration: 15.5, delay: 5.9, sway: 32, opacity: 0.4, tone: 'text-fuchsia-400/45 dark:text-fuchsia-400/25' },
  { left: 90, size: 18, duration: 11.5, delay: 1.6, sway: -26, opacity: 0.5, tone: 'text-rose-300/50 dark:text-rose-300/25' },
  { left: 17, size: 22, duration: 13.5, delay: 9.2, sway: 24, opacity: 0.35, tone: 'text-violet-300/40 dark:text-violet-300/25' },
  { left: 57, size: 15, duration: 12.8, delay: 10.4, sway: -20, opacity: 0.45, tone: 'text-rose-400/50 dark:text-rose-400/25' },
  { left: 41, size: 26, duration: 14.6, delay: 8.3, sway: 30, opacity: 0.35, tone: 'text-fuchsia-300/45 dark:text-fuchsia-300/25' },
  { left: 73, size: 16, duration: 11.8, delay: 11.1, sway: -22, opacity: 0.4, tone: 'text-orange-200/50 dark:text-orange-200/25' },
]

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
 * Собрать инлайн-стили сердечка из его раскладки.
 *
 * @param heart строка поля сердечек
 * @returns объект CSS-стилей и переменных для `:style`
 */
function heartStyle(heart: (typeof HEART_FIELD)[number]): Record<string, string> {
  return {
    left: `${heart.left}%`,
    fontSize: `${heart.size}px`,
    animationDuration: `${heart.duration}s`,
    animationDelay: `${heart.delay}s`,
    '--auth-heart-sway': `${heart.sway}px`,
    '--auth-heart-opacity': `${heart.opacity}`,
  }
}

/**
 * Поле всплывающих сердечек (детерминированное).
 */
const HEARTS: AuthBackdropHeart[] = HEART_FIELD.map((heart, index) => ({
  id: index + 1,
  toneClass: heart.tone,
  style: heartStyle(heart),
}))

/**
 * Токены фона для Login/Register: всегда ULove.
 *
 * Логика выбора убрана, отрисовка — в `AuthBackdrop.vue`
 * (Правило №1): ненавязчивое розовое утро с медленно
 * всплывающими сердцами, одинаковое на входе и регистрации —
 * поэтому переход между формами ровный, без смены фона.
 *
 * @returns токены фона ULove и поле сердечек
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

  return { theme, tokens, hearts: HEARTS }
}
