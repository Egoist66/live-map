import { computed, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { useLocalStorage } from '@vueuse/core'
import { businessApi } from '@/services/business.api'
import type { AccountType } from '@/types/entities/Business'

const STORAGE_KEY = 'upin_account_choice'

const visible = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

/**
 * Гейт «персона или компания» для первого визита.
 *
 * Гостю показываем модалку поверх заблюренного лендинга, выбор кладём
 * в localStorage и ведём в регистрацию (компания — с ?account=business).
 * Залогиненному без account_type — сохраняем через API и ведём в кабинет.
 *
 * @returns состояние гейта и действия выбора
 * @example const gate = useAccountTypeChoice(); gate.maybeShowGuest()
 */
export function useAccountTypeChoice() {
  const page = usePage()
  const stored = useLocalStorage<AccountType | null>(STORAGE_KEY, null)

  const authUser = computed(() => (page.props as unknown as { auth?: { user?: { account_type?: string } | null } }).auth?.user ?? null)

  const serverType = computed<AccountType | null>(() => {
    const raw = authUser.value?.account_type
    return raw === 'business' || raw === 'person' ? raw : null
  })

  const needsAuthChoice = computed(() => !!authUser.value && !serverType.value)
  const isBusiness = computed(() => serverType.value === 'business' || stored.value === 'business')

  function maybeShowGuest(): void {
    if (authUser.value) {
      return
    }
    if (stored.value) {
      return
    }
    visible.value = true
  }

  function maybeShowAuth(): void {
    if (needsAuthChoice.value && !visible.value) {
      visible.value = true
    }
  }

  function hide(): void {
    visible.value = false
  }

  /**
   * Выбор гостя: только localStorage + редирект в регистрацию.
   * @param next person|business
   */
  function chooseGuest(next: AccountType): void {
    stored.value = next
    visible.value = false
    if (next === 'business') {
      router.visit('/register?account=business')
      return
    }
    router.visit('/register')
  }

  /**
   * Выбор залогиненного: сохранение на сервере.
   * @param next person|business
   */
  async function chooseAuth(next: AccountType): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const res = await businessApi.setAccountType(next)
      stored.value = next
      visible.value = false
      if (authUser.value) {
        authUser.value.account_type = res.account_type
      }
      router.visit(res.landing)
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      error.value = message ?? 'Не получилось сохранить выбор'
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    if (typeof window === 'undefined') {
      return
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('account') === 'business') {
      stored.value = 'business'
    }
  })

  return {
    visible,
    saving,
    error,
    stored,
    serverType,
    needsAuthChoice,
    isBusiness,
    maybeShowGuest,
    maybeShowAuth,
    hide,
    chooseGuest,
    chooseAuth,
  }
}
