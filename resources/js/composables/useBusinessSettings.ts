import { computed, onMounted } from 'vue'
import { useBusinessStore } from '@/stores/business'
import { useTheme } from '@/composables/useTheme'
import { usePush } from '@/composables/usePush'
import { usePwaSettings } from '@/composables/usePwaSettings'
import { usePwaInstallGuide } from '@/composables/usePwaInstallGuide'

const LEGAL_FORM_LABELS: Record<string, string> = {
  ooo: 'ООО',
  ip: 'ИП',
  odo: 'ОДО',
  zao: 'ЗАО',
  self_employed: 'Самозанятый',
  craft: 'Ремесленник',
  other: 'Другое',
}

/**
 * Фасад настроек бизнеса: компания, тариф, уведомления, вид, приложение.
 *
 * Только бизнес-сущности — никаких персональных разделов
 * (свайпы, знакомства, режимы персоны).
 *
 * @returns стор, тема, пуши, PWA и подписи форм
 * @example const settings = useBusinessSettings()
 */
export function useBusinessSettings() {
  const store = useBusinessStore()
  const theme = useTheme()
  const push = usePush()
  const pwa = usePwaSettings()
  const guide = usePwaInstallGuide()

  const profile = computed(() => store.profile)
  const isVerified = computed(() => store.profile?.verification_status === 'verified')

  const planLabel = computed(() => {
    const plan = store.profile?.subscription_plan ?? 'free'
    if (plan === 'business') return 'Визитка бизнеса'
    if (plan === 'pro') return 'Pro'
    return 'Бесплатный'
  })

  /**
   * Подпись формы собственности по коду.
   * @param form код legal_form
   */
  function legalFormLabel(form: string | null | undefined): string {
    if (!form) return '—'
    return LEGAL_FORM_LABELS[form] ?? form
  }

  async function load(): Promise<void> {
    if (!store.dashboard && !store.loading) {
      await store.loadAll()
    }
  }

  onMounted(() => {
    void load()
  })

  return {
    store,
    profile,
    isVerified,
    planLabel,
    legalFormLabel,
    isDark: theme.isDark,
    toggleTheme: theme.toggle,
    push,
    pwa,
    guide,
    load,
  }
}
