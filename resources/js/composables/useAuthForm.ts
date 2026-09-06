import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { loginSchema } from '@/validation/schemas/login.schema'
import { registerSchema } from '@/validation/schemas/register.schema'
import { reverseGeocodeRaw } from '@/services/geo.api'
import { router } from '@inertiajs/vue3'

export function useLoginForm() {
  const showPass = ref(false)
  const { defineField, handleSubmit, errors, values, isSubmitting, setErrors } = useForm({
    validationSchema: loginSchema,
    initialValues: { email: '', password: '', remember: false } as any,
  })
  const [email, emailAttrs] = defineField('email')
  const [password, passwordAttrs] = defineField('password')
  const [remember] = defineField('remember')

  const submit = handleSubmit(async (vals: any) => {
    router.post(route('login'), vals, {
      onError: (errs: Record<string, string>) => setErrors(errs),
    })
  })

  return { email, emailAttrs, password, passwordAttrs, remember, errors, values, showPass, submit, isSubmitting }
}

export function useRegisterForm() {
  const showPass = ref(false)
  const showPass2 = ref(false)
  const locating = ref(false)
  const addrLoading = ref(false)

  const { defineField, handleSubmit, errors, values, isSubmitting, setValues, setErrors } = useForm({
    validationSchema: registerSchema,
    initialValues: { name: '', email: '', gender: null, password: '', password_confirmation: '', birth_date: null, country: null, country_code: null, home_city: null, home_lat: null, home_lng: null, home_radius_km: 5, home_address: '' } as any,
  })

  const [name, nameAttrs] = defineField('name')
  const [email, emailAttrs] = defineField('email')
  const [gender] = defineField('gender')
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

  async function detectLocation() {
    locating.value = true
    try {
      const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 6000 }))
      const lat = Number(pos.coords.latitude.toFixed(7))
      const lng = Number(pos.coords.longitude.toFixed(7))
      setValues({ home_lat: lat, home_lng: lng } as any)
      addrLoading.value = true
      try {
        const { address, raw } = await reverseGeocodeRaw(lat, lng, 14)
        const a: any = (raw as any)?.address || {}
        setValues({
          home_address: address,
          home_city: a.city || a.town || a.village || (values as any).home_city || null,
          country: a.country || (values as any).country || null,
          country_code: a.country_code ? String(a.country_code).toLowerCase() : (values as any).country_code || null,
        } as any)
      } catch {
        setValues({ home_address: `${lat}, ${lng}` } as any)
      } finally {
        addrLoading.value = false
      }
    } catch {
      alert('Не удалось определить местоположение')
    } finally {
      locating.value = false
    }
  }

  const submit = handleSubmit(async (vals: any) => {
    router.post(route('register'), vals, {
      onError: (errs: Record<string, string>) => setErrors(errs),
    })
  })

  return {
    name, nameAttrs, email, emailAttrs, gender, password, passwordAttrs, password_confirmation, passwordConfirmationAttrs,
    birth_date, country, country_code, home_city, home_lat, home_lng, home_radius_km, home_address, values, errors, showPass, showPass2, locating, addrLoading, detectLocation, submit, isSubmitting, setValues,
  }
}
