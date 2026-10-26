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
 * Классы таба переключателя «Войти / Регистрация»: табы без скруглений.
 * Активный таб — розовый текст и розовая нижняя полоска (бордер),
 * неактивный — нейтральный текст, полоска прозрачная (чтобы таб не
 * прыгал по высоте). Таб широкий и высокий: сегменты не сжимаются.
 *
 * @param active выбран ли таб
 * @returns строка Tailwind-классов для PrimeVue Button
 * @example tabClass(true)
 */
export function tabClass(active: boolean): string {
  const base =
    'w-full !rounded-none !border-0 !border-b-[3px] !bg-transparent !text-sm !font-semibold !py-3 sm:!py-3.5 transition-colors duration-200'

  if (active) {
    return `${base} !border-b-[#FF4267] !text-[#FF4267]`
  }

  return `${base} !border-b-transparent !text-stone-500 hover:!text-ink-900 dark:!text-zinc-400 dark:hover:!text-white`
}
