import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { route } from '@/route'

/**
 * Принятие публичной оферты при первом входе.
 *
 * Модалка показывается, пока у пользователя нет метки согласия.
 * После принятия сервер обновляет пропсы и модалка гаснет сама.
 * @returns флаг необходимости, состояние отправки и метод принятия
 * @example
 * const { needsAcceptance, accepting, accept } = useTermsAcceptance()
 */
export function useTermsAcceptance() {
  const page = usePage()
  const accepting = ref(false)

  const user = computed(() => (page.props.auth as any)?.user ?? null)
  const needsAcceptance = computed(() => !!user.value && !user.value.terms_accepted_at)

  /**
   * Отправляет согласие с действующей офертой.
   */
  async function accept(): Promise<void> {
    accepting.value = true
    try {
      await new Promise<void>((resolve, reject) => {
        router.post(route('terms.accept'), {}, {
          preserveScroll: true,
          onSuccess: () => resolve(),
          onError: (errs) => reject(new Error(JSON.stringify(errs))),
        })
      })
    } finally {
      accepting.value = false
    }
  }

  return { needsAcceptance, accepting, accept }
}
