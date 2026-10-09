import { computed, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAppModulesStore } from '@/stores/appModules'
import { SIGNUP_GOALS } from '@/composables/useSignupGoals'

/**
 * Видимость карт-бонуса на регистрации.
 *
 * Карта UPin — невыпущенный модуль: пока админ не включил `upin`
 * глобально, форма не упоминает карту и пины, а цель
 * «Соседи и карта» скрыта из селекта.
 * Блок «Моё место» остаётся всегда: без карты он работает
 * на точность расстояния в свайпах (отказ — только город
 * и страна в карточке). Админ выпустил карту — тексты
 * и цель возвращаются сами.
 *
 * @returns флаг карты, цели регистрации и тексты блока места
 * @example const reg = useRegisterVisibility()
 */
export function useRegisterVisibility() {
  const page = usePage()
  const store = useAppModulesStore()

  try {
    const raw = (page.props as unknown as { globalModules?: unknown }).globalModules

    if (raw !== undefined) {
      store.applyGlobal(raw)
    }
  } catch {
    // No-op: стор держит дефолт ['ulove'].
  }

  try {
    watch(
      () => (page.props as unknown as { globalModules?: unknown }).globalModules,
      (next) => {
        if (next !== undefined) {
          try {
            store.applyGlobal(next)
          } catch {
            // No-op: стор сам держит дефолт ULove.
          }
        }
      },
    )
  } catch {
    // No-op: без реактивности останется стартовый набор.
  }

  /** Выпущена ли карта админом. */
  const isMapEnabled = computed(() => store.isGloballyEnabled('upin'))

  /** Цели регистрации без карты, пока модуль не выпущен. */
  const goalOptions = computed(() => {
    if (isMapEnabled.value) {
      return [...SIGNUP_GOALS]
    }

    const withoutMap = SIGNUP_GOALS.filter((goal) => goal.value !== 'neighbors')

    return [...withoutMap]
  })

  /** Заголовок блока места: без карты — без слова «карта». */
  const locationTitle = computed(() => (isMapEnabled.value ? 'Моё место на карте' : 'Моё место'))

  /** Подсказка блока места: без карты — про точность расстояния в свайпах. */
  const locationHint = computed(() =>
    isMapEnabled.value
      ? 'Нажми — карта и твоя точка настроится сразу. Пропустишь — откроем страну и город из профиля, а точную точку покажешь позже кнопкой геолокации на карте.'
      : 'Для точности расстояния в свайпах. Пропустишь — в карточке будут только город и страна.',
  )

  /** Текст загрузки адреса: без карты — без слова «район». */
  const addressLoadingText = computed(() => (isMapEnabled.value ? 'Определяем район…' : 'Определяем адрес…'))

  return { isMapEnabled, goalOptions, locationTitle, locationHint, addressLoadingText }
}
