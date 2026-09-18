import '../css/app.css'
import 'primeicons/primeicons.css'
import './bootstrap'
import { initEcho } from './echo'
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
import { persistNativeMarker } from './composables/useNativeClient'

const appName = import.meta.env.VITE_APP_NAME || 'UPin'

createInertiaApp({
  title: (title) => {
    if (!title) return appName
    if (title.includes(appName)) return title
    return `${title} — ${appName}`
  },
  resolve: (name) => resolvePageComponent(`./Pages/${name}.vue`, import.meta.glob<DefineComponent>('./Pages/**/*.vue')),
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
        initEcho()
      } catch {}
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
          const auth = (props.initialPage.props as unknown as { auth?: { user?: { id?: number } } }).auth
          await useLastRoute().initLastRoute(Number(auth?.user?.id) || 0)
        } catch {}
      })()
    }
  },
  progress: { color: '#5B5BFF' },
})
