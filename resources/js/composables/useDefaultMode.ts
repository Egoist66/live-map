import { computed, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import axios from 'axios'
import type { DefaultMode } from '@/types/entities/User'

const visible = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const isNarrow = ref(false)

let mediaQuery: MediaQueryList | null = null

function onMediaChange(event: MediaQueryListEvent): void {
  isNarrow.value = event.matches
}

/**
 * Стартовый режим приложения: ULove-свайпы или UPin-карта.
 *
 * Читает auth.user.default_mode, показывает модалку «выбери сторону»
 * только когда режим ещё не выбран (NULL у старых пользователей).
 * Режим не ограничивает доступ — обе стороны всегда открыты.
 *
 * @returns состояние режима, флаги и действия выбора/перехода
 * @example const mode = useDefaultMode(); await mode.choose('upin')
 */
export function useDefaultMode() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any)?.user ?? null)

  const mode = computed<DefaultMode>(() => {
    const raw = user.value?.default_mode
    if (raw === 'upin' || raw === 'ulove') {
      return raw
    }
    return user.value?.signup_goal === 'neighbors' ? 'upin' : 'ulove'
  })

  const isChosen = computed(() => {
    const raw = user.value?.default_mode
    return raw === 'upin' || raw === 'ulove'
  })

  const isUpinDefault = computed(() => mode.value === 'upin')

  const landing = computed(() => (mode.value === 'upin' ? '/map' : '/swipes'))

  const needsChoice = computed(() => !!user.value && !isChosen.value)

  /**
   * Позиция диалога: bottom-sheet на узких экранах, центр на десктопе.
   */
  const dialogPosition = computed<'center' | 'bottom'>(() => (isNarrow.value ? 'bottom' : 'center'))

  function initViewport(): void {
    if (typeof window === 'undefined' || mediaQuery) {
      return
    }
    try {
      mediaQuery = window.matchMedia('(max-width: 639px)')
      isNarrow.value = mediaQuery.matches
      mediaQuery.addEventListener('change', onMediaChange)
    } catch {
      isNarrow.value = false
    }
  }

  onMounted(initViewport)

  function syncUser(next: DefaultMode): void {
    if (!user.value) {
      return
    }
    user.value.default_mode = next
    user.value.default_mode_set_at = new Date().toISOString()
  }

  function maybeShow(): void {
    try {
      const accountType = (page.props as unknown as { auth?: { user?: { account_type?: string } | null } }).auth?.user?.account_type
      if (accountType === 'business') {
        return
      }
    } catch {}
    if (needsChoice.value && !visible.value) {
      visible.value = true
    }
  }

  function hide(): void {
    visible.value = false
  }

  /**
   * Сохраняет выбранный стартовый режим на сервере.
   *
   * @param next ulove|upin
   */
  async function choose(next: DefaultMode): Promise<void> {
    saving.value = true
    error.value = null
    try {
      await axios.patch('/api/user/default-mode', { default_mode: next })
      syncUser(next)
      try {
        const { useAppModulesStore } = await import('@/stores/appModules')
        useAppModulesStore().adoptPrimaryLocal(next)
      } catch {
      }
      visible.value = false
    } catch (err: any) {
      error.value = err?.response?.data?.message || 'Не получилось сохранить выбор'
      throw err
    } finally {
      saving.value = false
    }
  }

  function goLanding(): void {
    router.visit(landing.value)
  }

  return {
    mode,
    isChosen,
    isUpinDefault,
    landing,
    needsChoice,
    isNarrow,
    dialogPosition,
    visible,
    saving,
    error,
    maybeShow,
    hide,
    choose,
    goLanding,
  }
}
