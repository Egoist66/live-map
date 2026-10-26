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
   * Класс сабмит-кнопки формы: сплошной брендовый #FF4267 (без
   * градиента), крупная высота и лёгкий отклик на нажатие.
   */
  const submitClass = computed(
    () =>
      'w-full !bg-[#FF4267] !border-0 !text-white !rounded-full !py-3.5 !text-[15px] !font-bold shadow-lg shadow-[#FF4267]/30 transition hover:brightness-105 active:scale-[0.99]',
  )

  const loginTitle = computed(() => 'С возвращением 💘')

  const loginSub = computed(() => 'Твои мэтчи и чаты уже ждут')

  const registerTitle = computed(() => 'Создай анкету')

  return {
    theme,
    isUlove,
    isUpin,
    isBusiness,
    submitClass,
    loginTitle,
    loginSub,
    registerTitle,
  }
}
