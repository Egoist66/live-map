import { ref, computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { updateProfileSchema } from '@/validation/schemas/profile.schema'
import { usePage, router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'

export function useProfileForm() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const { defineField, handleSubmit, errors, values, setValues, isSubmitting } = useForm({
    validationSchema: updateProfileSchema,
    initialValues: {
      name: user.value.name,
      email: user.value.email,
      home_lat: user.value.home_lat || null,
      home_lng: user.value.home_lng || null,
      home_radius_km: user.value.home_radius_km || 2,
      bio: user.value.bio || null,
      is_anonymous_default: !!user.value.is_anonymous_default,
      plan: user.value.plan || 'free',
    } as any,
  })

  watch(user, (u) => setValues({ name: u.name, email: u.email, home_lat: u.home_lat || null, home_lng: u.home_lng || null, home_radius_km: u.home_radius_km || 2, bio: u.bio || null, is_anonymous_default: !!u.is_anonymous_default, plan: u.plan || 'free' } as any))

  const [name, nameAttrs] = defineField('name')
  const [email, emailAttrs] = defineField('email')
  const [home_lat, homeLatAttrs] = defineField('home_lat')
  const [home_lng, homeLngAttrs] = defineField('home_lng')
  const [home_radius_km] = defineField('home_radius_km')
  const [bio] = defineField('bio')
  const [is_anonymous_default] = defineField('is_anonymous_default')
  const [plan] = defineField('plan')

  function useMyLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => setValues({ home_lat: Number(pos.coords.latitude.toFixed(7)), home_lng: Number(pos.coords.longitude.toFixed(7)) } as any))
  }

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

  return { user, name, nameAttrs, email, emailAttrs, home_lat, homeLatAttrs, home_lng, homeLngAttrs, home_radius_km, bio, is_anonymous_default, plan, errors, values, setValues, submit, isSubmitting, useMyLocation }
}
