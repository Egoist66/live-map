/**
 * Сброс realtime-сессии при смене аккаунта.
 *
 * Отдельный лёгкий модуль без зависимостей от `laravel-echo`/`pusher-js`:
 * функция работает только через `window.Echo`, поэтому её можно
 * статически импортировать из главного чанка (например, `useAuthSession`),
 * не затягивая ~70 КБ сокетов гостям на лендинге. Тяжёлый `echo.ts`
 * реэкспортирует её для обратной совместимости.
 *
 * @example
 * ```ts
 * import { resetEchoSession } from '@/services/echo-session'
 *
 * resetEchoSession([])
 * ```
 */

/**
 * Полный сброс realtime при смене аккаунта: покинуть приватные каналы
 * и разорвать сокет, чтобы чужой user.* не долетал в новый аккаунт.
 *
 * Безопасен для SSR (на Node — no-op) и для вызова до `initEcho`
 * (нет `window.Echo` — тихий выход).
 *
 * @param channels приватные каналы, которые нужно покинуть перед разрывом
 * @returns void
 */
export function resetEchoSession(channels: string[] = []): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const echo = (window as unknown as { Echo?: unknown }).Echo as
      | {
          leave?: (channel: string) => void
          connector?: { pusher?: { disconnect?: () => void } }
        }
      | undefined

    if (!echo) {
      return
    }

    channels.forEach((channel) => {
      try {
        echo.leave?.(channel)
      } catch {}
    })

    try {
      const pusher = echo.connector?.pusher

      if (pusher?.disconnect) {
        pusher.disconnect()
      }
    } catch {}
  } catch {}
}
