import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import type { App } from 'vue'

const UlovePreset = definePreset(Aura as any, {
  semantic: {
    primary: {
      50: '#FDF2F8', 100: '#FCE7F3', 200: '#FBCFE8', 300: '#F9A8D4', 400: '#F472B6', 500: '#F04D9F', 600: '#DB2777', 700: '#BE185D', 800: '#9D174D', 900: '#831843', 950: '#500724',
    },
    colorScheme: {
      light: { surface: { 0: '#FFFFFF', 50: '#F8F7F3', 100: '#F1F0ED', 200: '#E7E5E4', 300: '#D6D3D1', 400: '#A8A29E', 500: '#78716C', 600: '#57534E', 700: '#44403C', 800: '#292524', 900: '#1C1917', 950: '#0F172A' } },
      dark: { surface: { 0: '#0F121F', 50: '#151928', 100: '#0F121F', 200: '#27272A', 300: '#3F3F46', 400: '#52525B', 500: '#71717A', 600: '#A1A1AA', 700: '#D4D4D8', 800: '#E4E4E7', 900: '#FAFAFA', 950: '#FFFFFF' } },
    },
  },
  components: {
    button: {
      colorScheme: {
        light: { root: { primary: { background: '#0F172A', hoverBackground: '#1E293B', activeBackground: '#020617', borderColor: '#0F172A', hoverBorderColor: '#1E293B', color: '#FFFFFF', hoverColor: '#FFFFFF' } } },
        dark: { root: { primary: { background: '#FAFAFA', hoverBackground: '#E4E4E7', activeBackground: '#D4D4D8', borderColor: '#FAFAFA', hoverBorderColor: '#E4E4E7', color: '#0F121F', hoverColor: '#0F121F' } } },
      },
    },
  },
})

export function setupPrimeVue(app: App) {
  app.use(PrimeVue, {
    theme: { preset: UlovePreset, options: { darkModeSelector: '.dark', cssLayer: false } },
    ripple: false,
    zIndex: { modal: 1100, overlay: 1000, menu: 1000, tooltip: 1100 },
  } as any)
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)
  if (typeof document !== 'undefined') {
    const licenseSelector = '.p-license-host, .p-license-message, [data-p-license]'
    const hide = () => {
      document.querySelectorAll(licenseSelector).forEach((el) => ((el as HTMLElement).style.display = 'none'))
    }
    hide()
    // Ð”ÐµÑˆÑ‘Ð²Ñ‹Ð¹ ÑÑ‚Ð¾Ñ€Ð¾Ð¶ Ð²Ð¼ÐµÑÑ‚Ð¾ ÑÐºÐ°Ð½Ð° Ð²ÑÐµÐ³Ð¾ Ð´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ð° Ð½Ð° ÐºÐ°Ð¶Ð´ÑƒÑŽ Ð¼ÑƒÑ‚Ð°Ñ†Ð¸ÑŽ:
    // Ð¿Ð¾Ð»Ð½Ñ‹Ð¹ querySelectorAll â€” Ñ‚Ð¾Ð»ÑŒÐºÐ¾ ÐµÑÐ»Ð¸ ÑÑ€ÐµÐ´Ð¸ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð½Ñ‹Ñ… ÑƒÐ·Ð»Ð¾Ð² Ñ€ÐµÐ°Ð»ÑŒÐ½Ð¾
    // ÐµÑÑ‚ÑŒ Ð»Ð¸Ñ†ÐµÐ½Ð·Ð¸Ð¾Ð½Ð½Ñ‹Ð¹ Ð±ÐµÐ¹Ð´Ð¶, Ð²Ñ‹Ð·Ð¾Ð²Ñ‹ ÐºÐ¾Ð°Ð»ÐµÑÑ†Ð¸Ñ€ÑƒÑŽÑ‚ÑÑ Ñ‡ÐµÑ€ÐµÐ· rAF. ÐŸÐ¾Ð²ÐµÐ´ÐµÐ½Ð¸Ðµ
    // Ñ‚Ð¾ Ð¶Ðµ (Ð±ÐµÐ¹Ð´Ð¶ Ð¿Ñ€ÑÑ‡ÐµÑ‚ÑÑ Ð² Ñ‚Ð¾Ð¼ Ð¶Ðµ ÐºÐ°Ð´Ñ€Ðµ), ÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ Ð² Ñ‡Ð°Ñ‚Ð°Ñ…/Ð»ÐµÐ½Ñ‚Ð°Ñ…
    // Ñ Ð¿Ð¾Ñ‚Ð¾ÐºÐ¾Ð¼ Ð¼ÑƒÑ‚Ð°Ñ†Ð¸Ð¹ â€” Ð¾ÐºÐ¾Ð»Ð¾ Ð½ÑƒÐ»Ñ. SSR-Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð¾: Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð² Ð±Ñ€Ð°ÑƒÐ·ÐµÑ€Ðµ.
    let hideScheduled = false
    const scheduleHide = () => {
      if (hideScheduled) return
      hideScheduled = true
      const run = () => {
        hideScheduled = false
        hide()
      }
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(run)
      else setTimeout(run, 0)
    }
    const hasLicenseNode = (node: Node): boolean => {
      if (!(node instanceof HTMLElement)) return false
      if (node.matches(licenseSelector)) return true
      return node.querySelector(licenseSelector) !== null
    }
    const obs = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (hasLicenseNode(node)) {
            scheduleHide()
            return
          }
        }
      }
    })
    obs.observe(document.documentElement, { childList: true, subtree: true })
  }
}
