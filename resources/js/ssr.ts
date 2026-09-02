import { createSSRApp, h, DefineComponent } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createInertiaApp } from '@inertiajs/vue3'
import createServer from '@inertiajs/vue3/server'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { ZiggyVue } from '../../vendor/tightenco/ziggy'
import { createPinia } from 'pinia'

const appName = import.meta.env.VITE_APP_NAME || 'Live Map'

createServer((page) =>
  createInertiaApp({
    page,
    render: renderToString,
    title: (title) => {
      if (!title) return appName
      if (title.includes(appName)) return title
      return `${title} — ${appName}`
    },
    resolve: (name) =>
      resolvePageComponent(
        `./Pages/${name}.vue`,
        import.meta.glob<DefineComponent>('./Pages/**/*.vue'),
      ),
    setup({ App, props, plugin }) {
      const pinia = createPinia()
      const ziggy: any = (page.props as any).ziggy
      return createSSRApp({ render: () => h(App, props) })
        .use(plugin)
        .use(ZiggyVue, {
          ...ziggy,
          location: new URL(ziggy?.location ?? 'http://localhost'),
        } as any)
        .use(pinia)
    },
  }),
)
