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
 * неактивный — прозрачный ghost с мягким ховером. Именно заливка
 * читается «выбранным», поэтому вариант outlined для активного
 * запрещён — он выглядит наоборот. Таб широкий и высокий: сегменты
 * не сжимаются, текст не липнет к краям.
 *
 * @param active выбран ли таб
 * @returns строка Tailwind-классов для PrimeVue Button
 * @example tabClass(true)
 */
export function tabClass(active: boolean): string {
  const base = 'w-full !rounded-full !border-0 !text-sm !font-semibold !py-3 sm:!py-3.5 transition-all duration-200'

  if (active) {
    return `${base} !bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400 !text-white shadow-lg shadow-rose-500/30`
  }

  return `${base} !bg-transparent !text-stone-500 dark:!text-zinc-400 hover:!bg-white/70 dark:hover:!bg-white/10 hover:!text-ink-900 dark:hover:!text-white`
}
