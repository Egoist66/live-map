import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { usePage } from '@inertiajs/vue3'
import { createPinSchema } from '@/validation/schemas/createPin.schema'
import { usePinsStore } from '@/stores/pins'
import { useToast } from 'primevue/usetoast'

export function usePinCreate(onSuccess?: () => void) {
  const store = usePinsStore()
  const toast = useToast()
  const showCoords = ref(false)

  const authUser = (() => { try { return (usePage().props.auth as any)?.user } catch { return null } })()

  const { defineField, handleSubmit, setValues, values, errors, resetForm } = useForm({
    validationSchema: createPinSchema,
    initialValues: {
      title: '',
      body: '',
      category: 'announcement',
      latitude: 53.9022,
      longitude: 27.5615,
      location_precision: authUser?.default_location_precision || 'blur_200',
      blur_meters: Number(authUser?.default_blur_meters ?? 200),
      is_anonymous: false,
      radius_meters: 1000,
    } as any,
  })

  const [title, titleAttrs] = defineField('title')
  const [body] = defineField('body')
  const [category] = defineField('category')
  const [latitude] = defineField('latitude')
  const [longitude] = defineField('longitude')
  const [location_precision] = defineField('location_precision')
  const [blur_meters] = defineField('blur_meters')
  const [is_anonymous] = defineField('is_anonymous')
  const [radius_meters] = defineField('radius_meters')

  function setCoords(lat: number, lng: number) {
    setValues({ latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) } as any)
  }

  const error = ref<unknown>(null)

  const submit = handleSubmit(async (vals: any) => {
    error.value = null
    try {
      await store.createPin(vals)
      toast.add({ severity: 'success', summary: 'Пин создан', life: 2000 })
      resetForm({ values: { ...vals, title: '', body: '' } as any })
      onSuccess?.()
    } catch (e: any) {
      error.value = e
      toast.add({ severity: 'error', summary: e?.response?.data?.message || 'Ошибка создания', life: 3000 })
      throw e
    }
  })

  return {
    store,
    title,
    titleAttrs,
    body,
    category,
    latitude,
    longitude,
    location_precision,
    blur_meters,
    is_anonymous,
    radius_meters,
    values,
    errors,
    showCoords,
    creating: store.creating,
    error,
    setCoords,
    submit,
    setValues,
    resetForm,
  }
}
