import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAppModulesStore, type AppModule } from '@/stores/appModules'

/**
 * Тема страниц входа и регистрации.
 */
export type AuthTheme = 'ulove' | 'upin' | 'business'

/**
 * Тема auth-форм по запомненному выбору стороны приложения.
 *
 * Приоритет: `?account=business` → cookie `upin_side` (видна и SSR,
 * первый кадр сразу правильный, без флеша) → localStorage → upin.
 *
 * Гость выбрал ULove на лендинге — формы в Tinder-стиле
 * (огонь, розовый градиент, тексты про мэтчи, фон с сердцами).
 * Выбрал карту — формы UPin (маркер, синий градиент, фон с пинами).
 * `?account=business` — кабинет (фон со skyline роста).
 * Без выбора — нейтральный UPin.
 * Сайдбара больше нет нигде: все темы — стеклянная карточка
 * на весь экран поверх `AuthBackdrop`.
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

  /**
   * Подсказка сервера из cookie `upin_side`: единственный источник
   * темы, доступный и SSR, и клиенту. Убирает флеш чужой темы
   * на первом кадре (сервер рендерит сразу правильно).
   */
  const serverSide = computed<AppModule | null>(() => {
    try {
      const raw = (usePage().props as any)?.client?.side
      const normalized = String(raw ?? '').trim().toLowerCase()
      const known: AppModule[] = ['ulove', 'upin', 'uflow', 'districts', 'business']

      return (known as string[]).includes(normalized) ? (normalized as AppModule) : null
    } catch {
      return null
    }
  })

  const theme = computed<AuthTheme>(() => {
    if (isBusinessQuery.value) {
      return 'business'
    }

    const primary = serverSide.value ?? store.enabled?.[0]

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
