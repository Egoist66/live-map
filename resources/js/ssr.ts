import { createSSRApp, h, DefineComponent } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createInertiaApp } from '@inertiajs/vue3'
import createServer from '@inertiajs/vue3/server'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { ZiggyVue } from '../../vendor/tightenco/ziggy'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { setupPrimeVue } from './plugins/primevue'

const appName = import.meta.env.VITE_APP_NAME || 'UPin'

createServer((page) =>
  createInertiaApp({
    page,
    render: renderToString,
    title: (title) => {
      if (!title) return appName
      if (title.includes(appName)) return title
      return `${title} — ${appName}`
    },
    resolve: (name) => resolvePageComponent(`./Pages/${name}.vue`, import.meta.glob<DefineComponent>('./Pages/**/*.vue')),
    setup({ App, props, plugin }) {
      const pinia = createPinia()
      const ziggy: any = (page.props as any).ziggy ?? {}
      const ziggyConfig = { ...ziggy, location: new URL(ziggy?.location ?? 'http://localhost') }
      // Конфиг для SSR-safe `route()` из `@/route`: скрипты не видят blade-глобал Ziggy.
      ;(globalThis as any).Ziggy = ziggyConfig
      const app = createSSRApp({ render: () => h(App, props) })
        .use(plugin)
        .use(ZiggyVue, ziggyConfig as any)
        .use(pinia)
        .use(PiniaColada)
      setupPrimeVue(app)
      return app
    },
  }),
)
