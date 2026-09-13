import '../css/app.css'
import 'primeicons/primeicons.css'
import './bootstrap'
import './echo'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { createInertiaApp } from '@inertiajs/vue3'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { createApp, DefineComponent, h } from 'vue'
import { ZiggyVue } from '../../vendor/tightenco/ziggy'
import { setupPrimeVue } from './plugins/primevue'
import { register as registerSw } from './pwa/pwa.service'
import { useNativeShell } from './composables/useNativeShell'
import { useNativePush } from './composables/useNativePush'

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
    const app = createApp({ render: () => h(App, props) })
    app.use(plugin)
    app.use(ZiggyVue)
    app.use(pinia)
    app.use(PiniaColada)
    setupPrimeVue(app)
    app.mount(el)
    if (!import.meta.env.SSR) {
      try {
        registerSw()
      } catch {}
      void (async () => {
        try {
          await useNativeShell().initNativeShell()
        } catch {}
        try {
          await useNativePush().initNativePush()
        } catch {}
      })()
    }
  },
  progress: { color: '#5B5BFF' },
})
