import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { updatePinSchema } from '@/validation/schemas/updatePin.schema'
import { usePinsStore } from '@/stores/pins'
import { useToast } from 'primevue/usetoast'

export function usePinEdit() {
  const store = usePinsStore()
  const toast = useToast()
  const editing = ref(false)
  const targetId = ref<number | null>(null)

  const { defineField, handleSubmit, setValues, values, errors, resetForm } = useForm({
    validationSchema: updatePinSchema,
    initialValues: { title: '', body: '', category: 'announcement', gender_audience: 'all' } as any,
  })

  const [title, titleAttrs] = defineField('title')
  const [body] = defineField('body')
  const [category] = defineField('category')
  const [gender_audience] = defineField('gender_audience')

  const error = ref<unknown>(null)

  function start(pin: any) {
    targetId.value = pin.id
    setValues({ title: pin.title, body: pin.body || '', category: pin.category, gender_audience: pin.gender_audience ?? 'all' } as any)
    editing.value = true
  }

  function cancel() {
    editing.value = false
    targetId.value = null
  }

  const save = handleSubmit(async (vals: any) => {
    if (!targetId.value) return null
    try {
      const data = await (store.updatePin as any)({ id: targetId.value, payload: vals })
      editing.value = false
      toast.add({ severity: 'success', summary: 'Сохранено', life: 2000 })
      return data
    } catch (e: any) {
      toast.add({ severity: 'error', summary: e?.response?.data?.message || 'Ошибка', life: 3000 })
      throw e
    }
  })

  return { editing, targetId, title, titleAttrs, body, category, gender_audience, values, errors, start, cancel, save, setValues, resetForm, error, updating: store.updating }
}
