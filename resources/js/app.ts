// Свой primeicons без vendor-@font-face (font-display: block): иконочные
// классы здесь, а сам шрифт объявлен в app.css с swap. vendor-импорт
// убрали — иначе его font-face жил в соседнем чанке и в гонке порядков
// CSS мог перебить наш swap, оставив иконки невидимыми до загрузки.
import '../css/primeicons.css'
import '../css/app.css'
import './bootstrap'
import { createSSRApp, DefineComponent, h } from 'vue'
import { createInertiaApp } from '@inertiajs/vue3'
import { registerAppCore } from './plugins/app-core'
import { useAppBoot } from './composables/useAppBoot'
import { usePageResolver } from './composables/usePageResolver'
import { useBootRecovery } from './composables/useBootRecovery'

const appName = import.meta.env.VITE_APP_NAME || 'UPin'

const pageModules = import.meta.glob<DefineComponent>('./Pages/**/*.vue')
const { resolvePage } = usePageResolver(pageModules)
const { bootClientApp, extractAuthUserId } = useAppBoot()
const { markBooted, installGlobalRecovery, mountAppWithRecovery } = useBootRecovery()

createInertiaApp({
  title: (title) => {
    if (!title) return appName
    if (title.includes(appName)) return title
    return `${title} — ${appName}`
  },
  resolve: (name) => resolvePage(name),
  setup({ el, App, props, plugin }) {
    const app = createSSRApp({ render: () => h(App, props) })

    registerAppCore(app, { inertiaPlugin: plugin })
    installGlobalRecovery(app)
    mountAppWithRecovery(app, el)
    // Мост со сторожем blade (`__upinBooted`): без метки сторож решит,
    // что entry упал с 404, и начнёт лечить здоровую страницу.
    markBooted()
    const authUserId = extractAuthUserId(props.initialPage.props)
    void bootClientApp(authUserId)
  },
  progress: { color: '#5B5BFF' },
})
