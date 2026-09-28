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

  return { mode, isLogin, isRegister, showLogin, showRegister }
}
