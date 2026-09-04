import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import type { App } from 'vue'

const UPin = definePreset(Aura as any, {
  semantic: {
    primary: {
      50: '#EEF0FF', 100: '#E0E3FF', 200: '#C7CAFF', 300: '#A5AAFF', 400: '#8186FF', 500: '#5B5BFF', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#312E81', 950: '#1E1B4B',
    },
    colorScheme: {
      light: { surface: { 0: '#FFFFFF', 50: '#F8F7F3', 100: '#F1F0ED', 200: '#E7E5E4', 300: '#D6D3D1', 400: '#A8A29E', 500: '#78716C', 600: '#57534E', 700: '#44403C', 800: '#292524', 900: '#1C1917', 950: '#0F172A' } },
      dark: { surface: { 0: '#090E1A', 50: '#0B0F1A', 100: '#18181B', 200: '#27272A', 300: '#3F3F46', 400: '#52525B', 500: '#71717A', 600: '#A1A1AA', 700: '#D4D4D8', 800: '#E4E4E7', 900: '#FAFAFA', 950: '#FFFFFF' } },
    },
  },
  components: {
    button: {
      colorScheme: {
        light: { root: { primary: { background: '#0F172A', hoverBackground: '#1E293B', activeBackground: '#020617', borderColor: '#0F172A', hoverBorderColor: '#1E293B', color: '#FFFFFF', hoverColor: '#FFFFFF' } } },
        dark: { root: { primary: { background: '#FAFAFA', hoverBackground: '#E4E4E7', activeBackground: '#D4D4D8', borderColor: '#FAFAFA', hoverBorderColor: '#E4E4E7', color: '#090E1A', hoverColor: '#090E1A' } } },
      },
    },
  },
})

export function setupPrimeVue(app: App) {
  app.use(PrimeVue, {
    theme: { preset: UPin, options: { darkModeSelector: '.dark', cssLayer: false } },
    ripple: true,
    zIndex: { modal: 1100, overlay: 1000, menu: 1000, tooltip: 1100 },
  } as any)
  app.use(ToastService)
  app.use(ConfirmationService)
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
