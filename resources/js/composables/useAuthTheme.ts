import { computed } from 'vue'

/**
 * Тема страниц входа и регистрации.
 *
 * По ТЗ формы всегда в стиле ULove: механика запоминания таба
 * убрана, других тем больше нет. Флаги isUpin/isBusiness оставлены
 * для совместимости и всегда false.
 */
export type AuthTheme = 'ulove'

/**
 * Тема auth-форм: всегда ULove.
 *
 * Гость всегда видит Tinder-стиль (сердечко, розовый градиент,
 * тексты про мэтчи, фон с сердцами) — независимо от таба
 * лендинга и query-параметров.
 *
 * @returns тема, флаги, классы кнопок и тексты форм
 * @example const t = useAuthTheme()
 */
export function useAuthTheme() {
  const theme = computed<AuthTheme>(() => 'ulove')

  const isUlove = computed(() => true)
  const isUpin = computed(() => false)
  const isBusiness = computed(() => false)

  /**
   * Класс сабмит-кнопки формы: фирменный ULove-градиент.
   */
  const submitClass = computed(
    () =>
      'w-full !bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400 !border-0 !text-white !rounded-full !py-3.5 shadow-lg shadow-rose-500/30',
  )

  const loginTitle = computed(() => 'С возвращением 💘')

  const loginSub = computed(() => 'Твои мэтчи и чаты уже ждут')

  const registerTitle = computed(() => 'Создай анкету')

  const registerSub = computed(() => 'Свайпы людей рядом — мэтч открывает чат')

  return {
    theme,
    isUlove,
    isUpin,
    isBusiness,
    submitClass,
    loginTitle,
    loginSub,
    registerTitle,
    registerSub,
  }
}
