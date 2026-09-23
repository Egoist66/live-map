import { computed } from 'vue'
import { useAppModulesStore } from '@/stores/appModules'

/**
 * Тема страниц входа и регистрации.
 */
export type AuthTheme = 'ulove' | 'upin' | 'business'

/**
 * Тема auth-форм по запомненному выбору стороны приложения.
 *
 * Гость выбрал ULove на лендинге — формы в Tinder-стиле без
 * сайдбара (огонь, розовый градиент, тексты про мэтчи).
 * Выбрал карту — формы UPin (маркер, синий градиент, пины).
 * `?account=business` — кабинет (как было).
 * Без выбора — нейтральный UPin (старый вид).
 *
 * @returns тема, флаги, классы кнопок и тексты форм
 * @example const t = useAuthTheme()
 */
export function useAuthTheme() {
  const store = useAppModulesStore()

  try {
    store.ensureInit(null)
  } catch {
  }

  const isBusinessQuery = computed(() => {
    try {
      return new URLSearchParams(window.location.search).get('account') === 'business'
    } catch {
      return false
    }
  })

  const theme = computed<AuthTheme>(() => {
    if (isBusinessQuery.value) {
      return 'business'
    }

    const primary = store.enabled?.[0]

    if (primary === 'ulove' || primary === 'business') {
      return primary
    }

    return 'upin'
  })

  const isUlove = computed(() => theme.value === 'ulove')
  const isUpin = computed(() => theme.value === 'upin')
  const isBusiness = computed(() => theme.value === 'business')

  /**
   * Класс сабмит-кнопки формы под тему (полные строки для JIT).
   */
  const submitClass = computed(() =>
    isUlove.value
      ? 'w-full !bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400 !border-0 !text-white !rounded-full !py-3.5 shadow-lg shadow-rose-500/30'
      : isBusiness.value
        ? 'w-full !bg-gradient-to-r !from-indigo-500 !to-violet-600 !border-0 !text-white !rounded-full !py-3.5'
        : 'w-full !bg-gradient-to-r !from-sky-500 !via-blue-500 !to-indigo-500 !border-0 !text-white !rounded-full !py-3.5 shadow-lg shadow-sky-500/30',
  )

  const loginTitle = computed(() =>
    isUlove.value ? 'С возвращением 💘' : isBusiness.value ? 'Вход в кабинет' : 'С возвращением',
  )

  const loginSub = computed(() =>
    isUlove.value
      ? 'Твои мэтчи и чаты уже ждут'
      : isBusiness.value
        ? 'UPin Pro · данные бизнес-аккаунта'
        : 'Пины соседей и жизнь района уже ждут',
  )

  const registerTitle = computed(() =>
    isUlove.value ? 'Создай анкету' : isBusiness.value ? 'Кабинет компании' : 'Создай аккаунт',
  )

  const registerSub = computed(() =>
    isUlove.value
      ? 'Свайпы людей рядом — мэтч открывает чат'
      : isBusiness.value
        ? 'UPin Pro · проверка по УНП'
        : 'Карта района: пины, события и помощь рядом',
  )

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
