import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { updateProfileSchema } from '@/validation/schemas/profile.schema'
import { usePage, router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { maxHomeRadiusKm } from './usePlanLimits'
import { useHomeLocation } from './useHomeLocation'
import { useUserAge } from './useUserAge'
import { normalizeCountryCode } from './useResidence'
import { planOf } from './usePlanLimits'
import { useCountryMismatch } from './useCountryMismatch'
import { reverseGeocode } from '@/services/geo.api'
import { isUnchangedPayload } from './useUnchangedGuard'

export function useProfileForm() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const { defineField, handleSubmit, errors, values, setValues, setErrors, isSubmitting } = useForm({
    validationSchema: updateProfileSchema,
    initialValues: {
      name: user.value.name,
      gender: user.value.gender || null,
      birth_date: user.value.birth_date ? String(user.value.birth_date).slice(0, 10) : null,
      country: user.value.country || null,
      country_code: user.value.country_code || null,
      email: user.value.email,
      home_lat: user.value.home_lat || null,
      home_lng: user.value.home_lng || null,
      home_city: user.value.home_city || null,
      home_address: user.value.home_address || null,
      home_visibility: user.value.home_visibility || 'everyone',
      home_show_exact: !!user.value.home_show_exact,
      home_radius_km: user.value.home_radius_km || 10,
      bio: user.value.bio || null,
      is_anonymous_default: !!user.value.is_anonymous_default,
      plan: planOf(user.value),
    } as any,
  })

  watch(user, (u) => setValues({ name: u.name, gender: u.gender || null, birth_date: u.birth_date ? String(u.birth_date).slice(0, 10) : null, country: u.country || null, country_code: u.country_code || null, email: u.email, home_lat: u.home_lat || null, home_lng: u.home_lng || null, home_city: u.home_city || null, home_address: u.home_address || null, home_visibility: u.home_visibility || 'everyone', home_show_exact: !!u.home_show_exact, home_radius_km: u.home_radius_km || 10, bio: u.bio || null, is_anonymous_default: !!u.is_anonymous_default, plan: planOf(u) } as any))

  const [name, nameAttrs] = defineField('name')
  const [gender] = defineField('gender')
  const [birth_date] = defineField('birth_date')
  const [country] = defineField('country')
  const [country_code] = defineField('country_code')
  const [email, emailAttrs] = defineField('email')
  const [home_lat, homeLatAttrs] = defineField('home_lat')
  const [home_lng, homeLngAttrs] = defineField('home_lng')
  const [home_city] = defineField('home_city')
  const [home_address] = defineField('home_address')
  const [home_visibility] = defineField('home_visibility')
  const [home_show_exact] = defineField('home_show_exact')
  const [home_radius_km] = defineField('home_radius_km')
  const [bio] = defineField('bio')
  const [is_anonymous_default] = defineField('is_anonymous_default')
  const [plan] = defineField('plan')

  const homeLocation = useHomeLocation({
    getPlan: () => String((values as any).plan || planOf(user.value)),
    isAdmin: () => !!user.value?.is_admin || user.value?.role === 'admin',
    getBlur: () => Number(user.value?.default_blur_meters ?? 300),
    setCoords: (lat, lng, address) => setValues({ home_lat: lat, home_lng: lng, home_address: address || (values as any).home_address } as any),
  })

  function useMyLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(7))
      const lng = Number(pos.coords.longitude.toFixed(7))
      let address = ''
      try { address = await reverseGeocode(lat, lng) } catch { address = '' }
      setValues({ home_lat: lat, home_lng: lng, home_address: address || (values as any).home_address } as any)
    })
  }

  const maxRadius = computed(() => maxHomeRadiusKm((values as any).plan || planOf(user.value)))

  const canChangeEmail = computed(() => {
    const u = user.value
    if (!u) return false
    if (u.is_admin || u.role === 'admin') return true
    return planOf(u) === 'business'
  })

  watch(() => (values as any).plan, (pl) => {
    const m = maxHomeRadiusKm(pl || 'free')
    const cur = Number((values as any).home_radius_km ?? 1)
    if (cur > m) setValues({ home_radius_km: m } as any)
  })

  const residenceCheck = useCountryMismatch(() => ({
    country: (values as any).country,
    country_code: (values as any).country_code,
    lat: (values as any).home_lat,
    lng: (values as any).home_lng,
  }))

  /** Ключи формы, участвующие в сохранении (plan — только для UI-лимитов). */
  const dirtyKeys = [
    'name',
    'gender',
    'birth_date',
    'country',
    'country_code',
    'email',
    'home_lat',
    'home_lng',
    'home_city',
    'home_address',
    'home_visibility',
    'home_show_exact',
    'home_radius_km',
    'bio',
    'is_anonymous_default',
  ]

  const submit = handleSubmit(async (vals: any) => {
    const payload: any = { ...vals }
    if (typeof payload.bio === 'string') {
      const t = payload.bio.trim()
      payload.bio = t === '' ? null : t
    }
    if (payload.bio === '') payload.bio = null
    if (payload.country_code) payload.country_code = normalizeCountryCode(payload.country_code)
    if (payload.birth_date === '') payload.birth_date = null
    if (isUnchangedPayload(payload, user.value ?? {}, dirtyKeys)) {
      toast?.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
      return
    }
    if (!isAdmin.value) {
      const residenceOk = await residenceCheck.recheckCountry()
      if (!residenceOk) {
        const msg = residenceCheck.countryWarning.value || 'Страна не совпадает с геолокацией'
        setErrors({ country: msg })
        toast?.add({ severity: 'error', summary: 'Сохранение запрещено', detail: msg, life: 4000 })
        return
      }
    }
    router.patch(route('profile.update'), payload, {
      preserveScroll: true,
      onSuccess: () => toast?.add({ severity: 'success', summary: 'Профиль сохранён', life: 2000 }),
      onError: (e: any) => {
        try { setErrors(e) } catch {}
        toast?.add({ severity: 'error', summary: 'Ошибка', detail: Object.values(e || {}).flat().join(', ') || 'Не удалось сохранить', life: 3000 })
      },
    })
  })

  const age = useUserAge(() => (values as any).birth_date)
  const isAdmin = computed(() => !!user.value?.is_admin || user.value?.role === 'admin')
  const countryWarning = computed(() => (isAdmin.value ? null : residenceCheck.countryWarning.value))
  const checkingCountry = computed(() => (isAdmin.value ? false : residenceCheck.checkingCountry.value))

  return { user, name, nameAttrs, gender, birth_date, age: age.age, ageLabel: age.label, country, country_code, email, emailAttrs, canChangeEmail, home_lat, homeLatAttrs, home_lng, homeLngAttrs, home_city, home_address, home_visibility, home_show_exact, home_radius_km, bio, is_anonymous_default, plan, errors, values, setValues, setErrors, submit, isSubmitting, useMyLocation, maxRadius, homeLocation, countryWarning, checkingCountry }
}
