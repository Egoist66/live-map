import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import type { App } from 'vue'

export function setupPrimeVue(app: App) {
  app.use(PrimeVue, {
    theme: {
      preset: Aura as any,
      options: { darkModeSelector: '.dark', cssLayer: false },
    },
    ripple: true,
    zIndex: { modal: 1100, overlay: 1000, menu: 1000, tooltip: 1100 },
  } as any)
  app.use(ToastService)
  app.directive('tooltip', Tooltip)
  if (typeof document !== 'undefined') {
    const hide = () => {
      document.querySelectorAll('.p-license-host, .p-license-message, [data-p-license]').forEach((el) => ((el as HTMLElement).style.display = 'none'))
    }
    hide()
    const obs = new MutationObserver(hide)
    obs.observe(document.documentElement, { childList: true, subtree: true })
  }
}
