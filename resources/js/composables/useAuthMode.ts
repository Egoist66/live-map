import { computed, ref } from 'vue'

/**
 * Тогл «Вход / Регистрация» на единой auth-странице Auth/Login.
 *
 * Вся логика переключения живёт здесь, страница только отображает:
 * `mode` — текущий таб, `showLogin`/`showRegister` — переходы.
 * По умолчанию всегда вход.
 *
 * @returns mode/isLogin/isRegister и методы переключения
 * @example
 * const { isLogin, showRegister } = useAuthMode()
 */
export type AuthMode = 'login' | 'register'

export function useAuthMode() {
  const mode = ref<AuthMode>('login')

  const isLogin = computed(() => mode.value === 'login')
  const isRegister = computed(() => mode.value === 'register')

  function showLogin(): void {
    mode.value = 'login'
  }

  function showRegister(): void {
    mode.value = 'register'
  }

  return { mode, isLogin, isRegister, showLogin, showRegister, tabClass }
}

/**
 * Классы таба сегмент-переключателя: активный залит бренд-градиентом,
 * неактивный — прозрачный ghost. Именно заливка читается «выбранным»,
 * поэтому вариант outlined для активного запрещён — он выглядит наоборот.
 *
 * @param active выбран ли таб
 * @returns строка Tailwind-классов для PrimeVue Button
 * @example tabClass(true)
 */
export function tabClass(active: boolean): string {
  if (active) {
    return '!bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400 !text-white !border-0 shadow-lg shadow-rose-500/30'
  }

  return '!bg-transparent !border-0 !text-stone-500 dark:!text-zinc-400 hover:!text-ink-900 dark:hover:!text-white'
}
