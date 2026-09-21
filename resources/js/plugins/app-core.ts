import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { ZiggyVue } from '../../../vendor/tightenco/ziggy'
import { setupPrimeVue } from './primevue'
import type { App, Plugin } from 'vue'

/**
 * Ядро Vue-приложения: Pinia + Colada + Ziggy + PrimeVue.
 *
 * Единая точка регистрации для `app.ts` (клиент) и `ssr.ts` (сервер) —
 * порядок установки плагинов зафиксирован один раз и не разъезжается
 * между dev/prod и CSR/SSR: Inertia → Ziggy → Pinia → Colada → PrimeVue.
 *
 * Клиентского DOM/Realtime/PWA здесь нет — только изоморфные плагины,
 * поэтому файл безопасен для SSR (нет `window`/`document`).
 *
 * @example
 * ```ts
 * // app.ts (клиент)
 * const app = createSSRApp({ render: () => h(App, props) })
 * registerAppCore(app, { inertiaPlugin: plugin })
 *
 * // ssr.ts (сервер)
 * const app = createSSRApp({ render: () => h(App, props) })
 * registerAppCore(app, { inertiaPlugin: plugin, ziggyConfig })
 * ```
 */
export interface AppCoreOptions {
  /** Inertia-плагин из `setup({ plugin })` — ставится первым. */
  inertiaPlugin: Plugin
  /** Конфиг Ziggy для SSR (`route()` без blade-глобала). На клиенте не нужен. */
  ziggyConfig?: Record<string, unknown>
}

/**
 * Зарегистрировать ядро плагинов на Vue-приложении.
 *
 * @param app Vue-приложение из `createSSRApp`
 * @param options Inertia-плагин и опциональный конфиг Ziggy
 * @returns то же приложение для чейнинга
 */
export function registerAppCore(app: App, options: AppCoreOptions): App {
  const pinia = createPinia()

  app.use(options.inertiaPlugin)

  const hasZiggyConfig = options.ziggyConfig !== undefined

  if (hasZiggyConfig) {
    app.use(ZiggyVue, options.ziggyConfig as never)
  } else {
    app.use(ZiggyVue)
  }

  app.use(pinia)
  app.use(PiniaColada)

  setupPrimeVue(app)

  return app
}
