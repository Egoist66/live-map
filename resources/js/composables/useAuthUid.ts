import { usePage } from '@inertiajs/vue3'


/**
 * Id текущего пользователя, доступный из любого места.
 *
 * Раньше uid читали из `window.__inertia_page`, который нигде не
 * присваивается: получали всегда 0 и `openRouletteFromNav` гнал
 * залогиненных на /login → guest-middleware возвращал их на /profile.
 * Здесь uid захватывается из Inertia-страницы в setup и хранится
 * в модуле — читать можно из интервалов и Pinia-экшенов.
 */
let cachedUid = 0

/**
 * Запомнить id юзера из текущей Inertia-страницы.
 *
 * Звать в теле composable, который вызывается из setup
 * (usePage работает только в setup-контексте).
 *
 * @example
 * export function useVideoSession() {
 *   captureAuthUid()
 *   // ...
 * }
 */
export function captureAuthUid(): void {
  try {
    const user = (usePage().props.auth as { user?: { id?: number } } | undefined)?.user
    const id = Number(user?.id || 0)
    if (id > 0) {
      cachedUid = id
    }
  } catch {
    // Вне setup (SSR-пререндер без страницы) — оставляем прошлый.
  }
}

/**
 * Текущий id пользователя (0 — гость или захват ещё не было).
 *
 * @returns id юзера
 */
export function currentAuthUid(): number {
  return cachedUid || 0
}
