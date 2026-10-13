import { register as registerSw } from '@/pwa/pwa.service'
import { startPushBridges } from '@/pwa/push.service'
import { hideSplash } from '@/composables/useSplash'
import { initScrollRescue } from '@/composables/useScrollRescue'
import { useIdleTask } from '@/composables/useIdleTask'
import { useOverlaySafeArea } from '@/composables/useOverlaySafeArea'
import { useLastRoute } from '@/composables/useLastRoute'
import { initTheme } from '@/composables/useTheme'
import { initMotion } from '@/composables/useMotion'
import { persistNativeMarker } from '@/composables/useNativeClient'
import { purgeLegacyAuthMirror } from '@/composables/useAuthStorage'

/**
 * Быстрый синхронный предикат «похоже на Telegram Mini App».
 *
 * Проверяет только URL-маркеры и куку прошлого TG-визита — без
 * динамических импортов, поэтому дешёвый для 95%+ нетелеграмного
 * трафика: чанк `useTelegram` вообще не грузится в первом визите.
 * Точную проверку (`initData`) делает `bootTelegram` после импорта.
 *
 * @returns true если визит может быть из Telegram
 */
function looksLikeTelegram(): boolean {
  try {
    if (typeof window === 'undefined') {
      return false
    }

    const haystack = (window.location.search + ' ' + window.location.hash).toLowerCase()

    const hasUrlMarkers =
      haystack.includes('tgwebappplatform') ||
      haystack.includes('tgwebappdata') ||
      haystack.includes('tgwebappversion')

    if (hasUrlMarkers) {
      return true
    }

    return /(?:^|;\s*)upin_client=telegram(-webapp)?(?:;|$)/.test(document.cookie)
  } catch {
    return false
  }
}

/**
 * Клиентский бут приложения после `app.mount()`.
 *
 * Вся DOM/Realtime/PWA-логика из `setup()` в `app.ts` живёт здесь
 * (Правило №1: логика — в хуках, не в точке входа).
 * Вызывать строго после mount: splash/safe-area зависят от живого DOM,
 * `useLastRoute` — от установленного Inertia-плагина.
 *
 * Безопасен для dev и prod:
 * - первым делом выходит на SSR (`import.meta.env.SSR` / нет `window`);
 * - тяжёлый realtime (`./echo`, ~70KB) и `expo-push` грузятся только
 *   динамическим `import()` и только залогиненным — лендинг/гости
 *   не тянут лишний чанк;
 * - каждый шаг изолирован: падение одного не роняет остальные
 *   (прежние silent `try/catch` сохранены как `safeRun`).
 *
 * @example
 * ```ts
 * app.mount(el)
 * await bootClientApp(authUserId)
 * ```
 */
export function useAppBoot() {
  /**
   * Выполнить шаг бута, проглотив ошибку.
   *
   * Сохраняет прежнее поведение app.ts: ни один необязательный
   * шаг (тема, SW, пуши) не должен ронять визит.
   *
   * @param step шаг инициализации (возвращаемое значение игнорируется)
   * @returns void
   */
  async function safeRun(step: () => unknown | Promise<unknown>): Promise<void> {
    try {
      await step()
    } catch {
      // No-op: шаг необязательный, визит продолжает жить.
    }
  }

  /**
   * Подключить realtime-шину только для авторизованных.
   *
   * Динамический импорт сохраняет код-сплиттинг: гости
   * не скачивают `laravel-echo + pusher-js`.
   *
   * @param authUserId id пользователя из initialPage (0 — гость)
   * @returns void
   */
  async function bootRealtime(authUserId: number): Promise<void> {
    const isGuest = authUserId <= 0

    if (isGuest) {
      return
    }

    const echo = await import('@/echo')
    echo.initEcho()
  }

  /**
   * Подключить нативный Expo-push мост (только клиент, тихо).
   *
   * Гостям мост не нужен: токен привязывается к пользователю
   * (`/api/expo-push-tokens` требует auth) — пропускаем импорт,
   * чтобы лендинг не тянул лишний чанк в первом визите.
   *
   * @param authUserId id пользователя из initialPage (0 — гость)
   * @returns void
   */
  async function bootExpoPush(authUserId: number): Promise<void> {
    if (authUserId <= 0) {
      return
    }

    const expoPush = await import('@/native/expo-push')
    expoPush.initExpoPushBinding()
  }

  /**
   * Инициализировать геометрию safe-area и возврат на последний экран.
   *
   * @param authUserId id пользователя из initialPage (0 — гость)
   * @returns void
   */
  async function bootNavigation(authUserId: number): Promise<void> {
    const safeArea = useOverlaySafeArea()
    safeArea.initOverlaySafeArea()

    const lastRoute = useLastRoute()
    await lastRoute.initLastRoute(authUserId)
  }

  /**
   * Подключить Telegram Mini App: мост + автовход по initData.
   *
   * Только внутри Telegram (isTelegramWebView): грузим
   * telegram-web-app.js, делаем ready/expand, затем тихий
   * authWithTelegram — гость превращается в сессию без кликов.
   * Вне TG — мгновенный no-op, на TBT не влияет.
   *
   * Быстрый предикат по URL-маркерам — ДО первого динамического
   * импорта: 95%+ трафика (браузеры, PWA) не тянут чанк
   * `useTelegram` в первом визите вообще. Маркер `upin_client`
   * в куке означает прошлый визит из TG — тогда проверяем
   * полноценно (кука могла протухнуть, см. ранний инлайн в blade).
   *
   * @returns void
   */
  async function bootTelegram(): Promise<void> {
    if (!looksLikeTelegram()) {
      return
    }

    const { isTelegramWebView } = await import('@/composables/useTelegram')

    if (!isTelegramWebView()) {
      return
    }

    const { useTelegram } = await import('@/composables/useTelegram')
    const { initTelegram, persistTelegramMarker, syncChrome } = useTelegram()

    persistTelegramMarker()

    const insideTelegram = await initTelegram()

    if (!insideTelegram) {
      return
    }

    const isDark = document.documentElement.classList.contains('dark')
    syncChrome(isDark)

    const { useTelegramAuth } = await import('@/composables/useTelegramAuth')
    const { authWithTelegram } = useTelegramAuth()
    await authWithTelegram()

    const { useTelegramNavigation } = await import('@/composables/useTelegramNavigation')
    const { initTelegramNavigation } = useTelegramNavigation()
    initTelegramNavigation()
  }

  /**
   * Выполнить весь клиентский бут после монтирования Vue.
   *
   * Визуальное (маркер, тема, motion, сплэш, safe-area) — сразу, это
   * первый paint. Тяжёлое сетевое (echo ~70КБ, SW-регистрация + прекеш,
   * push-мосты, expo) — в idle: раньше всё это ехало до paint и вместе
   * с 8 инитами лейаута давало TBT 1100мс (Lighthouse).
   *
   * Telegram идёт сразу после маркеров: ready/expand должны случиться
   * до первого paint, иначе Mini App моргает схлопнутым окном.
   *
   * Визуальные шаги независимы (пишут в разные места: классы, storage,
   * сплэш, safe-area) — идут параллельно одним `allSettled`, а не
   * восемью последовательными `await`: цепочка суммировала их латентность
   * в TBT первого визита.
   *
   * @param authUserId id пользователя из initialPage (0 — гость)
   * @returns void
   */
  async function bootClientApp(authUserId: number): Promise<void> {
    const isServer = import.meta.env.SSR || typeof window === 'undefined'

    if (isServer) {
      return
    }

    await Promise.allSettled([
      safeRun(() => persistNativeMarker()),
      safeRun(() => purgeLegacyAuthMirror()),
      safeRun(() => bootTelegram()),
      safeRun(() => initTheme()),
      safeRun(() => initMotion()),
      safeRun(() => hideSplash()),
      safeRun(() => initScrollRescue()),
      safeRun(() => bootNavigation(authUserId)),
    ])

    const { runWhenIdle } = useIdleTask()

    await safeRun(() =>
      runWhenIdle(async () => {
        await Promise.allSettled([
          bootRealtime(authUserId),
          registerSw(),
          startPushBridges(),
          bootExpoPush(authUserId),
        ])
      }),
    )
  }

  /**
   * Достать id пользователя из initialPage Inertia.
   *
   * @param initialPageProps пропсы первой страницы (`props.initialPage.props`)
   * @returns числовой id или 0 для гостя
   */
  function extractAuthUserId(initialPageProps: unknown): number {
    const props = initialPageProps as { auth?: { user?: { id?: number } } }
    const rawId = Number(props?.auth?.user?.id)

    const isValid = Number.isFinite(rawId) && rawId > 0

    if (!isValid) {
      return 0
    }

    return rawId
  }

  return { bootClientApp, extractAuthUserId }
}
