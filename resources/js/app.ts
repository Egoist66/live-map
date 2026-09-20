import '../css/app.css'
import 'primeicons/primeicons.css'
import './bootstrap'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { createInertiaApp } from '@inertiajs/vue3'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { createSSRApp, DefineComponent, h } from 'vue'
import { ZiggyVue } from '../../vendor/tightenco/ziggy'
import { setupPrimeVue } from './plugins/primevue'
import { register as registerSw } from './pwa/pwa.service'
import { startPushBridges } from './pwa/push.service'
import { hideSplash } from './composables/useSplash'
import { useOverlaySafeArea } from './composables/useOverlaySafeArea'
import { useLastRoute } from './composables/useLastRoute'
import { initTheme } from './composables/useTheme'
import { initMotion } from './composables/useMotion'
import { applyPersistentLayout } from './composables/usePersistentLayout'
import { persistNativeMarker } from './composables/useNativeClient'

const appName = import.meta.env.VITE_APP_NAME || 'UPin'

const pageModules = import.meta.glob<DefineComponent>('./Pages/**/*.vue')

/**
 * Загрузка страницы Inertia с одной повторной попыткой и жёстким fallback.
 *
 * Зачем: динамический import страницы может упасть — в dev холодный
 * transform тяжёлой страницы не укладывается в таймаут прокси (504,
 * `Failed to fetch dynamically imported module`), на проде после деплоя
 * можно приехать в stale-чанк. Без обработки визит умирает с uncaught
 * promise и мёртвым экраном. Повтор обычно подбирает уже прогретый
 * модуль; если нет — полная перезагрузка подтягивает свежий манифест.
 *
 * @param name имя Inertia-страницы (например `'Dashboard'`)
 * @returns модуль страницы с назначенным персистентным лейаутом
 */
async function resolvePageWithRetry(name: string) {
  try {
    const module = await resolvePageComponent<DefineComponent>(`./Pages/${name}.vue`, pageModules)
    applyPersistentLayout(name, module.default)
    return module
  } catch (firstError) {
    await new Promise((done) => setTimeout(done, 800))
    try {
      const module = await resolvePageComponent<DefineComponent>(`./Pages/${name}.vue`, pageModules)
      applyPersistentLayout(name, module.default)
      return module
    } catch {
      window.location.reload()
      throw firstError
    }
  }
}

createInertiaApp({
  title: (title) => {
    if (!title) return appName
    if (title.includes(appName)) return title
    return `${title} — ${appName}`
  },
  resolve: (name) => resolvePageWithRetry(name),
  setup({ el, App, props, plugin }) {
    const pinia = createPinia()
    const app = createSSRApp({ render: () => h(App, props) })
    app.use(plugin)
    app.use(ZiggyVue)
    app.use(pinia)
    app.use(PiniaColada)
    setupPrimeVue(app)
    app.mount(el)
    if (!import.meta.env.SSR) {
      try {
        persistNativeMarker()
      } catch {}
      try {
        initTheme()
      } catch {}
      try {
        initMotion()
      } catch {}
      // Realtime (laravel-echo + pusher-js, ~70KB) грузим только залогиненным:
      // гостям на лендинге/логине он не нужен.
      const pageAuth = (props.initialPage.props as unknown as { auth?: { user?: { id?: number } } }).auth
      const authUserId = Number(pageAuth?.user?.id) || 0
      void (async () => {
        if (authUserId > 0) {
          try {
            const echo = await import('./echo')
            echo.initEcho()
          } catch {}
        }
      })()
      try {
        registerSw()
      } catch {}
      try {
        hideSplash()
      } catch {}
      try {
        startPushBridges()
      } catch {}
      try {
        void import('./native/expo-push').then((m) => m.initExpoPushBinding()).catch(() => {})
      } catch {}
      void (async () => {
        try {
          useOverlaySafeArea().initOverlaySafeArea()
        } catch {}
        try {
          await useLastRoute().initLastRoute(authUserId)
        } catch {}
      })()
    }
  },
  progress: { color: '#5B5BFF' },
})
