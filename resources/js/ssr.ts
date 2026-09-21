import { createSSRApp, h, DefineComponent } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createInertiaApp } from '@inertiajs/vue3'
import createServer from '@inertiajs/vue3/server'
import { registerAppCore } from './plugins/app-core'
import { usePageResolver } from './composables/usePageResolver'

const appName = import.meta.env.VITE_APP_NAME || 'UPin'

const pageModules = import.meta.glob<DefineComponent>('./Pages/**/*.vue')
const { resolvePage } = usePageResolver(pageModules)

createServer((page) =>
  createInertiaApp({
    page,
    render: renderToString,
    title: (title) => {
      if (!title) return appName
      if (title.includes(appName)) return title
      return `${title} — ${appName}`
    },
    resolve: (name) => resolvePage(name),
    setup({ App, props, plugin }) {
      const ziggy: any = (page.props as any).ziggy ?? {}
      const ziggyLocation = ziggy?.location ?? 'http://localhost'
      const ziggyConfig = { ...ziggy, location: new URL(ziggyLocation) }
      // Конфиг для SSR-safe `route()` из `@/route`: скрипты не видят blade-глобал Ziggy.
      ;(globalThis as any).Ziggy = ziggyConfig

      const app = createSSRApp({ render: () => h(App, props) })

      registerAppCore(app, { inertiaPlugin: plugin, ziggyConfig })

      return app
    },
  }),
)
