import { computed, onMounted, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { usePwa } from '@/composables/usePwa'
import { usePwaInstallGuide } from '@/composables/usePwaInstallGuide'

/** Сколько дней после регистрации считать пользователя новичком. */
export const PWA_NEWCOMER_DAYS = 14

const DISMISS_KEY = 'pwa-install-dismissed'

/**
 * Баннер «Установить UPin» для новичков и всех, у кого доступен промпт.
 *
 * Показывается, пока не установлен standalone и не закрыт окончательно
 * (localStorage): либо есть системный промпт, либо пользователь новичок.
 * Без промпта кнопка ведёт на инструкцию под платформу.
 *
 * @returns состояние баннера и действия
 * @example
 * const { visible, install, dismiss } = usePwaInstallBanner()
 */
export function usePwaInstallBanner() {
  const { canInstall, standalone, promptInstall } = usePwa()
  const guide = usePwaInstallGuide()
  // Детерминированный старт для SSR: сервер и первая гидрация всегда
  // видят dismissed=false. Флаг из стореджа подтягивается в onMounted,
  // иначе баннер мигает по-разному и даёт hydration mismatch.
  const dismissed = ref(false)

  onMounted(() => {
    try {
      dismissed.value = localStorage.getItem(DISMISS_KEY) === '1' || sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {}
  })

  /** Пользователь новичок: гость или регистрация в последние дни. */
  const isNewcomer = computed(() => {
    let createdAt: string | null = null
    try {
      createdAt = (usePage().props.auth as any)?.user?.created_at ?? null
    } catch {
      createdAt = null
    }
    if (!createdAt) return true
    const created = new Date(createdAt).getTime()
    if (Number.isNaN(created)) return true
    const ageMs = Date.now() - created
    return ageMs < PWA_NEWCOMER_DAYS * 24 * 60 * 60 * 1000
  })

  /** Показывать баннер, пока не установлен standalone и не закрыт. */
  const visible = computed(() => {
    if (standalone.value || dismissed.value) return false
    return canInstall.value || isNewcomer.value
  })

  function dismiss(): void {
    dismissed.value = true
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  /** Установить: сразу системный промпт, без подсказок; инструкция — только если промпта нет. */
  async function install(): Promise<void> {
    if (!canInstall.value) {
      guide.openGuide()
      return
    }
    const outcome = await promptInstall()
    if (outcome !== 'unavailable') dismiss()
  }

  return { canInstall, standalone, dismissed, visible, isNewcomer, hint: guide.hint, install, dismiss }
}
