import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { updateProfileSchema } from '@/validation/schemas/profile.schema'
import { usePage, router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { maxHomeRadiusKm } from './usePlanLimits'
import { useHomeLocation } from './useHomeLocation'
import { reverseGeocode } from '@/services/geo.api'

export function useProfileForm() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const { defineField, handleSubmit, errors, values, setValues, isSubmitting } = useForm({
    validationSchema: updateProfileSchema,
    initialValues: {
      name: user.value.name,
      gender: user.value.gender || null,
      email: user.value.email,
      home_lat: user.value.home_lat || null,
      home_lng: user.value.home_lng || null,
      home_city: user.value.home_city || null,
      home_address: user.value.home_address || null,
      home_visibility: user.value.home_visibility || 'everyone',
      home_show_exact: !!user.value.home_show_exact,
      home_radius_km: user.value.home_radius_km || 5,
      bio: user.value.bio || null,
      is_anonymous_default: !!user.value.is_anonymous_default,
      plan: user.value.plan || 'free',
    } as any,
  })

  watch(user, (u) => setValues({ name: u.name, gender: u.gender || null, email: u.email, home_lat: u.home_lat || null, home_lng: u.home_lng || null, home_city: u.home_city || null, home_address: u.home_address || null, home_visibility: u.home_visibility || 'everyone', home_show_exact: !!u.home_show_exact, home_radius_km: u.home_radius_km || 5, bio: u.bio || null, is_anonymous_default: !!u.is_anonymous_default, plan: u.plan || 'free' } as any))

  const [name, nameAttrs] = defineField('name')
  const [gender] = defineField('gender')
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
    getPlan: () => String((values as any).plan || user.value?.plan || 'free'),
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

  const maxRadius = computed(() => maxHomeRadiusKm((values as any).plan || user.value?.plan || 'free'))

  watch(() => (values as any).plan, (pl) => {
    const m = maxHomeRadiusKm(pl || 'free')
    const cur = Number((values as any).home_radius_km ?? 1)
    if (cur > m) setValues({ home_radius_km: m } as any)
  })

  const submit = handleSubmit((vals: any) => {
    const payload: any = { ...vals }
    if (typeof payload.bio === 'string') {
      const t = payload.bio.trim()
      payload.bio = t === '' ? null : t
    }
    if (payload.bio === '') payload.bio = null
    router.patch(route('profile.update'), payload, {
      preserveScroll: true,
      onSuccess: () => toast?.add({ severity: 'success', summary: 'Профиль сохранён', life: 2000 }),
      onError: (e: any) => toast?.add({ severity: 'error', summary: 'Ошибка', detail: Object.values(e || {}).flat().join(', ') || 'Не удалось сохранить', life: 3000 }),
    })
  })

  return { user, name, nameAttrs, gender, email, emailAttrs, home_lat, homeLatAttrs, home_lng, homeLngAttrs, home_city, home_address, home_visibility, home_show_exact, home_radius_km, bio, is_anonymous_default, plan, errors, values, setValues, submit, isSubmitting, useMyLocation, maxRadius, homeLocation }
}
