import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAppModulesStore } from '@/stores/appModules'

/**
 * Чистый ULove-режим: включён только модуль ulove, карта и лента выключены.
 *
 * Та же формула, что в useChatPage.uloveOnly: в этом режиме прячутся
 * настройки и разделы других модулей (колонки профиля, пины, UFlow,
 * друзья) — остаётся только ULove, приложение и новости.
 *
 * @returns флаг чистого ULove-режима
 * @example const uloveOnly = useUloveOnly()
 */
export function useUloveOnly() {
  const modules = useAppModulesStore()

  try {
    modules.ensureInit(
      (usePage().props as unknown as { auth?: { user?: unknown } }).auth?.user ?? null,
    )
  } catch {
  }

  const isBusiness = computed(() => {
    try {
      const user = (usePage().props as unknown as { auth?: { user?: { account_type?: string } | null } }).auth?.user

      return (user?.account_type ?? 'person') === 'business'
    } catch {
      return false
    }
  })

  const uloveOnly = computed(
    () =>
      !isBusiness.value &&
      modules.isEnabled('ulove') &&
      !modules.isEnabled('upin') &&
      !modules.isEnabled('uflow'),
  )

  return uloveOnly
}
