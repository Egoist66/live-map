import { ref } from 'vue'
import { usePwa } from '@/composables/usePwa'

export function usePwaInstallBanner() {
  const { canInstall, standalone, promptInstall } = usePwa()
  const dismissed = ref(false)

  try {
    dismissed.value = sessionStorage.getItem('pwa-install-dismissed') === '1'
  } catch {}

  function dismiss(): void {
    dismissed.value = true
    try {
      sessionStorage.setItem('pwa-install-dismissed', '1')
    } catch {}
  }

  async function install(): Promise<void> {
    const outcome = await promptInstall()
    if (outcome !== 'unavailable') dismiss()
  }

  return { canInstall, standalone, dismissed, install, dismiss }
}
