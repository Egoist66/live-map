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
 * Классы таба сегмент-переключателя: ОБА таба залиты сплошным
 * брендовым #FF4267 (как кнопка «Дальше» и сабмит форм) — одинаково
 * на светлой и тёмной теме. Активный таб отличается только мягким
 * свечением и полной насыщенностью, неактивный — приглушён и бледнеет
 * на ховере (вариант outlined/ghost для табов запрещён по ТЗ).
 * Таб широкий и высокий: сегменты не сжимаются, текст не липнет
 * к краям.
 *
 * @param active выбран ли таб
 * @returns строка Tailwind-классов для PrimeVue Button
 * @example tabClass(true)
 */
export function tabClass(active: boolean): string {
  const base =
    'w-full !rounded-full !border-0 !bg-[#FF4267] !text-white !text-sm !font-semibold !py-3 sm:!py-3.5 shadow-lg shadow-[#FF4267]/30 transition-all duration-200'

  if (active) {
    return base
  }

  return `${base} opacity-65 hover:opacity-90 active:opacity-100`
}
