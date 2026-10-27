import { computed, nextTick, ref } from 'vue'
import { useForm } from 'vee-validate'
import { loginSchema } from '@/validation/schemas/login.schema'
import { registerSchema } from '@/validation/schemas/register.schema'
import { forwardGeocodePlace, reverseGeocodeHome } from '@/services/geo.api'
import { useCountryMismatch } from '@/composables/useCountryMismatch'
import { useSignupGoals } from '@/composables/useSignupGoals'
import { useHoneypot } from '@/composables/useTurnstile'
import { useToast } from 'primevue/usetoast'
import { router } from '@inertiajs/vue3'
import { route } from '@/route'

export function useLoginForm() {
  const showPass = ref(false)
  // Токен Turnstile (прогрессивная капча: бэк требует после 2 фейлов)
  // и honeypot-значение — уходят вне vee-validate схемы, полями запроса.
  const captchaToken = ref('')
  const trap = useHoneypot()
  const { defineField, handleSubmit, errors, values, isSubmitting, setErrors } = useForm({
    validationSchema: loginSchema,
    initialValues: { email: '', password: '' } as any,
  })
  const [email, emailAttrs] = defineField('email')
  const [password, passwordAttrs] = defineField('password')

  const submit = handleSubmit(async (vals: any) => {
    router.post(
      route('login'),
      { ...vals, captcha_token: captchaToken.value || undefined, website: trap.value.value || undefined },
      {
        onError: (errs: Record<string, string>) => setErrors(errs),
      },
    )
  })

  return { email, emailAttrs, password, passwordAttrs, errors, values, showPass, submit, isSubmitting, captchaToken, trap }
}

/**
 * Форма регистрации: базовые поля + опциональная геопозиция.
 *
 * Домашняя зона не настраивается на регистрации — всем выдаётся
 * Free-радиус 5 км по умолчанию, меняется позже в тарифе/настройках.
 * Кнопка геопозиции лишь задаёт точку карты и подпись адреса.
 */
export function useRegisterForm() {
  const showPass = ref(false)
  const showPass2 = ref(false)
  const locating = ref(false)
  const addrLoading = ref(false)
  const goals = useSignupGoals()
  const goalPreset = goals.preset

  const { defineField, handleSubmit, errors, values, isSubmitting, setValues, setErrors, validateField } = useForm({
    validationSchema: registerSchema,
    initialValues: {
      name: '',
      email: '',
      gender: null,
      password: '',
      password_confirmation: '',
      birth_date: null,
      country: null,
      country_code: null,
      home_city: null,
      home_lat: null,
      home_lng: null,
      home_radius_km: 5,
      home_address: '',
      signup_goal: goalPreset.goal,
    } as any,
  })

  /**
   * Шаги регистрации: короткие экраны без длинного полотна полей.
   * `fields` — что валидируем перед переходом на следующий шаг.
   */
  const steps = [
    {
      id: 'about',
      title: 'О тебе',
      hint: 'Цель знакомств, имя и дата рождения.',
      fields: ['signup_goal', 'name', 'gender', 'birth_date'],
    },
    {
      id: 'location',
      title: 'Где ты',
      hint: 'Город и точка на карте — покажем людей рядом.',
      fields: ['country', 'home_city', 'home_lat', 'home_lng'],
    },
    {
      id: 'account',
      title: 'Аккаунт',
      hint: 'Почта и пароль для входа в ULove.',
      fields: ['email', 'password', 'password_confirmation'],
    },
  ] as const

  const stepIndex = ref(0)
  const totalSteps = steps.length
  const currentStep = computed(() => steps[stepIndex.value])
  const stepNumber = computed(() => stepIndex.value + 1)
  const isFirstStep = computed(() => stepIndex.value === 0)
  const isLastStep = computed(() => stepIndex.value === totalSteps - 1)
  const progress = computed(() => Math.round((stepNumber.value / totalSteps) * 100))

  /**
   * Валидирует только поля текущего шага.
   *
   * @returns true, если шаг можно закрыть
   */
  async function validateCurrentStep(): Promise<boolean> {
    const checks = currentStep.value.fields.map((field) => validateField(field))
    const results = await Promise.all(checks)
    return results.every((result) => result.valid)
  }

  /**
   * Поднимает форму к началу: на мобиле следующий шаг не должен
   * открываться «где-то ниже» после скролла к кнопке «Дальше».
   */
  function scrollToFormTop(): void {
    if (typeof window === 'undefined') return
    void nextTick(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  /**
   * Переключает шаг с ограничением диапазона.
   *
   * @param index индекс шага
   */
  function goToStep(index: number): void {
    const clamped = Math.min(Math.max(index, 0), totalSteps - 1)
    if (clamped === stepIndex.value) return
    stepIndex.value = clamped
    scrollToFormTop()
  }

  /**
   * Проверяет текущий шаг и переводит на следующий.
   */
  async function nextStep(): Promise<void> {
    if (isLastStep.value) return
    const valid = await validateCurrentStep()
    if (!valid) return
    goToStep(stepIndex.value + 1)
  }

  /**
   * Возвращает на предыдущий шаг без валидации.
   */
  function goBack(): void {
    goToStep(stepIndex.value - 1)
  }

  /**
   * Находит шаг, к которому относится ошибка сервера.
   *
   * @param stepErrors ошибки от бэка
   * @returns индекс шага или null
   */
  function stepIndexOfError(stepErrors: Record<string, string>): number | null {
    const foundIndex = steps.findIndex((step) =>
      step.fields.some((field) => !!stepErrors[field]),
    )
    if (foundIndex !== -1) return foundIndex
    if (stepErrors.captcha_token) return totalSteps - 1
    return null
  }

  /**
   * Показывает ошибки сервера и открывает нужный шаг.
   *
   * @param stepErrors ошибки от бэка
   */
  function showErrors(stepErrors: Record<string, string>): void {
    setErrors(stepErrors)
    const errorStep = stepIndexOfError(stepErrors)
    if (errorStep !== null) goToStep(errorStep)
  }

  const [name, nameAttrs] = defineField('name')
  const [email, emailAttrs] = defineField('email')
  const [gender] = defineField('gender')
  const [signup_goal] = defineField('signup_goal')
  const [password, passwordAttrs] = defineField('password')
  const [password_confirmation, passwordConfirmationAttrs] = defineField('password_confirmation')
  const [birth_date] = defineField('birth_date')
  const [country] = defineField('country')
  const [country_code] = defineField('country_code')
  const [home_city] = defineField('home_city')
  const [home_lat] = defineField('home_lat')
  const [home_lng] = defineField('home_lng')
  const [home_radius_km] = defineField('home_radius_km')
  const [home_address] = defineField('home_address')

  // Капча обязательна на регистрации (бэк: ValidTurnstile) + honeypot.
  const captchaToken = ref('')
  const trap = useHoneypot()

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as any
    }
  })()

  const residenceCheck = useCountryMismatch(() => ({
    country: (values as any).country,
    country_code: (values as any).country_code,
    lat: (values as any).home_lat,
    lng: (values as any).home_lng,
  }))

  /**
   * Определяет геопозицию и подставляет адрес/город/страну.
   * Без геопозиции карта позже откроется по стране+городу из профиля.
   */
  async function detectLocation(): Promise<void> {
    locating.value = true
    try {
      const pos = await readBrowserPosition()
      const lat = Number(pos.coords.latitude.toFixed(7))
      const lng = Number(pos.coords.longitude.toFixed(7))
      setValues({ home_lat: lat, home_lng: lng } as any)
      addrLoading.value = true
      try {
        const geo = await reverseGeocodeHome(lat, lng)
        const prevCity = (values as any).home_city || null
        const prevCountry = (values as any).country || null
        const prevCode = (values as any).country_code || null
        setValues({
          home_address: geo.address,
          home_city: geo.city || prevCity,
          country: geo.country || prevCountry,
          country_code: geo.country_code || prevCode,
        } as any)
      } catch {
        setValues({ home_address: `${lat}, ${lng}` } as any)
      } finally {
        addrLoading.value = false
      }
    } catch {
      toast?.add({
        severity: 'warn',
        summary: 'Без геопозиции',
        detail: 'Карта откроется по стране и городу из профиля',
        life: 3500,
      })
    } finally {
      locating.value = false
    }
  }

  /**
   * Убирает ранее определённую точку.
   */
  function clearLocation(): void {
    setValues({ home_lat: null, home_lng: null, home_address: '' } as any)
  }

  const submit = handleSubmit(async (vals: any) => {
    const payload = {
      ...vals,
      home_radius_km: 5,
      account_type: 'person',
      captcha_token: captchaToken.value,
      website: trap.value.value || undefined,
    }
    if (goalPreset.locked) {
      payload.signup_goal = goalPreset.goal
    }

    if (payload.home_lat == null || payload.home_lng == null) {
      const placeQuery = [payload.home_city, payload.country]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(', ')

      if (placeQuery !== '') {
        const coords = await forwardGeocodePlace(placeQuery)

        if (coords) {
          payload.home_lat = coords.lat
          payload.home_lng = coords.lng
        }
      }
    }

    try {
      const { useAppModulesStore } = await import('@/stores/appModules')
      const remembered = useAppModulesStore().registrationPayload()
      payload.landing_tab = remembered.landing_tab
      payload.enabled_modules = remembered.enabled_modules
    } catch {
    }
    const residenceOk = await residenceCheck.recheckCountry()
    if (!residenceOk) {
      const msg = residenceCheck.countryWarning.value || 'Страна не совпадает с геолокацией'
      showErrors({ country: msg })
      toast?.add({ severity: 'error', summary: 'Сохранение запрещено', detail: msg, life: 4000 })
      return
    }
    router.post(route('register'), payload, {
      onError: (errs: Record<string, string>) => showErrors(errs),
    })
  })

  /**
   * Enter/кнопка формы: на последнем шаге отправляет анкету,
   * на остальных — проверяет поля и листает дальше.
   */
  async function onSubmit(): Promise<void> {
    if (!isLastStep.value) {
      await nextStep()
      return
    }
    await submit()
  }

  return {
    name,
    nameAttrs,
    email,
    emailAttrs,
    gender,
    signup_goal,
    password,
    passwordAttrs,
    password_confirmation,
    passwordConfirmationAttrs,
    birth_date,
    country,
    country_code,
    home_city,
    home_lat,
    home_lng,
    home_radius_km,
    home_address,
    values,
    errors,
    showPass,
    showPass2,
    locating,
    addrLoading,
    detectLocation,
    clearLocation,
    submit,
    onSubmit,
    currentStep,
    stepNumber,
    totalSteps,
    isFirstStep,
    isLastStep,
    progress,
    nextStep,
    goBack,
    isSubmitting,
    setValues,
    goalPreset,
    captchaToken,
    trap,
    countryWarning: residenceCheck.countryWarning,
    checkingCountry: residenceCheck.checkingCountry,
  }
}

/**
 * Однократно читает позицию браузера.
 * @throws {GeolocationPositionError | Error} если геолокация недоступна
 */
function readBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокация недоступна'))
      return
    }
    const onOk = (pos: GeolocationPosition): void => resolve(pos)
    const onErr = (err: GeolocationPositionError): void => reject(err)
    const opts: PositionOptions = { enableHighAccuracy: false, timeout: 6000 }
    navigator.geolocation.getCurrentPosition(onOk, onErr, opts)
  })
}
