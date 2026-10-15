import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { loginSchema } from '@/validation/schemas/login.schema'
import { registerSchema } from '@/validation/schemas/register.schema'
import { reverseGeocodeRaw } from '@/services/geo.api'
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

  const { defineField, handleSubmit, errors, values, isSubmitting, setValues, setErrors } = useForm({
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
        const geo = await reverseGeocodeRaw(lat, lng, 14)
        const rawAddr: any = (geo.raw as any)?.address || {}
        const city = rawAddr.city || rawAddr.town || rawAddr.village
        const prevCity = (values as any).home_city || null
        const prevCountry = (values as any).country || null
        const prevCode = (values as any).country_code || null
        const code = rawAddr.country_code ? String(rawAddr.country_code).toLowerCase() : null
        setValues({
          home_address: geo.address,
          home_city: city || prevCity,
          country: rawAddr.country || prevCountry,
          country_code: code || prevCode,
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
      setErrors({ country: msg })
      toast?.add({ severity: 'error', summary: 'Сохранение запрещено', detail: msg, life: 4000 })
      return
    }
    router.post(route('register'), payload, {
      onError: (errs: Record<string, string>) => setErrors(errs),
    })
  })

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
