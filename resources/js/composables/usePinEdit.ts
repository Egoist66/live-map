import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { updatePinSchema } from '@/validation/schemas/updatePin.schema'
import { usePinsStore } from '@/stores/pins'
import { useSosConfirm } from '@/composables/useSosConfirm'
import { useToast } from 'primevue/usetoast'
import { isUnchangedPayload } from '@/composables/useUnchangedGuard'

export function usePinEdit() {
  const store = usePinsStore()
  const toast = useToast()
  const editing = ref(false)
  const targetId = ref<number | null>(null)
  const sos = useSosConfirm()

  /**
   * Выбрать категорию: SOS проходит через предупреждение об ответственности.
   * @param value код категории
   */
  function selectCategory(value: string): void {
    if (sos.isSos(value) && String((category as any)?.value ?? '') !== 'sos') {
      sos.requestSos(() => setValues({ category: 'sos' } as any))
      return
    }
    setValues({ category: value } as any)
  }

  const { defineField, handleSubmit, setValues, values, errors, resetForm } = useForm({
    validationSchema: updatePinSchema,
    initialValues: { title: '', body: '', category: 'announcement', gender_audience: 'all' } as any,
  })

  const [title, titleAttrs] = defineField('title')
  const [body] = defineField('body')
  const [category] = defineField('category')
  const [gender_audience] = defineField('gender_audience')

  const error = ref<unknown>(null)
  /** Снимок пина на момент start() для пропуска запроса без изменений. */
  const editSnapshot = ref<Record<string, unknown> | null>(null)

  function start(pin: any) {
    targetId.value = pin.id
    sos.resetSos()
    setValues({ title: pin.title, body: pin.body || '', category: pin.category, gender_audience: pin.gender_audience ?? 'all' } as any)
    editSnapshot.value = { title: pin.title, body: pin.body || '', category: pin.category, gender_audience: pin.gender_audience ?? 'all' }
    editing.value = true
  }

  function cancel() {
    editing.value = false
    targetId.value = null
    editSnapshot.value = null
    sos.resetSos()
  }

  const save = handleSubmit(async (vals: any) => {
    if (!targetId.value) return null
    const snapshot = editSnapshot.value
    if (snapshot !== null && isUnchangedPayload(vals, snapshot, ['title', 'body', 'category', 'gender_audience'])) {
      toast.add({ severity: 'info', summary: 'Без изменений', detail: 'Нечего сохранять', life: 2000 })
      return null
    }
    try {
      const payload = { ...vals, sos_confirmed: sos.sosConfirmed.value }
      const data = await (store.updatePin as any)({ id: targetId.value, payload })
      editing.value = false
      editSnapshot.value = null
      sos.resetSos()
      toast.add({ severity: 'success', summary: 'Сохранено', life: 2000 })
      return data
    } catch (e: any) {
      toast.add({ severity: 'error', summary: e?.response?.data?.message || 'Ошибка', life: 3000 })
      throw e
    }
  })

  return { editing, targetId, title, titleAttrs, body, category, gender_audience, values, errors, start, cancel, save, setValues, resetForm, error, updating: store.updating, sos, selectCategory }
}
