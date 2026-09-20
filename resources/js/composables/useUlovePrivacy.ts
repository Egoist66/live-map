import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { datingApi } from '@/services/dating.api'

/** Ключи приватности ULove, хранящиеся на бэке. */
export type UlovePrivacyKey = 'dating_match_only' | 'dating_hide_name' | 'dating_hide_age' | 'dating_hide_distance'

/** Значения переключателей приватности ULove. */
export interface UlovePrivacyFlags {
  dating_match_only: boolean
  dating_hide_name: boolean
  dating_hide_age: boolean
  dating_hide_distance: boolean
}

/** Платная фишка ULove для отображения в табе. */
export interface UlovePrivacyFeature {
  key: UlovePrivacyKey
  title: string
  plan: 'Free' | 'PRO'
  icon: string
  iconClass: string
  needsPro: boolean
}

/**
 * Приватность ULove в настройках профиля.
 *
 * Таб «ULove»: все платные фишки знакомств с включением
 * по тарифу профиля. Скрытие имени/возраста/расстояния — PRO,
 * «пишут только мэтчи» — бесплатно. Сохранение мгновенное,
 * при ошибке переключатель возвращается назад.
 *
 * @returns флаги, фишки, тариф и действия таба
 * @example const ulove = useUlovePrivacy()
 */
export function useUlovePrivacy() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)

  const flags = ref<UlovePrivacyFlags>({
    dating_match_only: !!authUser.value?.dating_match_only,
    dating_hide_name: !!authUser.value?.dating_hide_name,
    dating_hide_age: !!authUser.value?.dating_hide_age,
    dating_hide_distance: !!authUser.value?.dating_hide_distance,
  })

  const saving = ref(false)
  const error = ref<string | null>(null)

  const features: UlovePrivacyFeature[] = [
    {
      key: 'dating_match_only',
      title: 'Пишут только мэтчи',
      plan: 'Free',
      icon: 'pi pi-lock',
      iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      needsPro: false,
    },
    {
      key: 'dating_hide_name',
      title: 'Скрыть имя',
      plan: 'PRO',
      icon: 'pi pi-user',
      iconClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
      needsPro: true,
    },
    {
      key: 'dating_hide_age',
      title: 'Скрыть возраст',
      plan: 'PRO',
      icon: 'pi pi-calendar',
      iconClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
      needsPro: true,
    },
    {
      key: 'dating_hide_distance',
      title: 'Скрыть расстояние',
      plan: 'PRO',
      icon: 'pi pi-send',
      iconClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
      needsPro: true,
    },
  ]

  /** Тариф профиля для гейта платных фишек. */
  const plan = computed(() => String(authUser.value?.effective_plan || authUser.value?.plan || 'free'))

  /** Подпись тарифа для таба. */
  const planLabel = computed(() => {
    if (plan.value === 'business') return 'Business'
    if (plan.value === 'pro') return 'PRO'
    return 'Free'
  })

  /** Доступны ли PRO-фишки: PRO / Business / админ. */
  const canPro = computed(() => {
    if (!!authUser.value?.is_admin || authUser.value?.role === 'admin') return true
    return plan.value === 'pro' || plan.value === 'business'
  })

  /**
   * Закрыта ли фишка тарифом профиля.
   * @param key ключ фишки
   * @returns true если нужна PRO, а её нет
   */
  function isLocked(key: UlovePrivacyKey): boolean {
    const feature = features.find((f) => f.key === key)
    return !!feature?.needsPro && !canPro.value
  }

  /**
   * Подпись текущего состояния фишки.
   * @param key ключ фишки
   * @returns статус для отображения под названием
   */
  function statusFor(key: UlovePrivacyKey): string {
    if (key === 'dating_match_only') {
      return flags.value.dating_match_only ? 'Личка закрыта от незнакомцев' : 'Писать может кто угодно'
    }
    if (key === 'dating_hide_name') {
      return flags.value.dating_hide_name ? 'Имя скрыто' : 'Все видят твоё имя'
    }
    if (key === 'dating_hide_age') {
      return flags.value.dating_hide_age ? 'Возраст скрыт' : 'Все видят твой возраст'
    }
    return flags.value.dating_hide_distance ? 'Расстояние скрыто · виден только город' : 'Все видят расстояние до тебя'
  }

  /**
   * Переключить фишку с мгновенным сохранением.
   *
   * PRO-фишки без тарифа не трогает, при ошибке
   * возвращает переключатель в прежнее положение.
   *
   * @param key ключ фишки
   * @param next новое значение
   */
  async function toggle(key: UlovePrivacyKey, next: boolean): Promise<void> {
    if (isLocked(key) || saving.value) {
      return
    }
    const prev = flags.value[key]
    flags.value[key] = next
    error.value = null
    saving.value = true
    try {
      await datingApi.updateSettings({ ...flags.value })
    } catch (e: unknown) {
      flags.value[key] = prev
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось сохранить — попробуй ещё раз'
    } finally {
      saving.value = false
    }
  }

  return { flags, features, planLabel, canPro, saving, error, isLocked, statusFor, toggle }
}
