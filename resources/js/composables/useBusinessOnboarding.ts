import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useForm } from 'vee-validate'
import { useToast } from 'primevue/usetoast'
import { businessSchema } from '@/validation/schemas/business.schema'
import { useBusinessStore } from '@/stores/business'
import type { BusinessProfilePayload } from '@/types/entities/Business'

const LEGAL_FORM_OPTIONS = [
  { label: 'ООО', value: 'ooo' },
  { label: 'ИП', value: 'ip' },
  { label: 'ОДО', value: 'odo' },
  { label: 'ЗАО', value: 'zao' },
  { label: 'Самозанятый', value: 'self_employed' },
  { label: 'Ремесленник', value: 'craft' },
  { label: 'Другое', value: 'other' },
]

/**
 * Онбординг компании в 3 шага (законодательство РБ).
 *
 * 1 — компания (название, форма, категория), 2 — реквизиты
 * (УНП 9 цифр, юрадрес, руководитель), 3 — точка (адрес, карта, контакты).
 *
 * @returns шаг, форма и действия next/back/finish
 * @example const ob = useBusinessOnboarding()
 */
export function useBusinessOnboarding() {
  const store = useBusinessStore()
  const toast = useToast()
  const step = ref(0)

  const { defineField, handleSubmit, errors, values, setValues } = useForm({
    validationSchema: businessSchema,
    initialValues: {
      name: '',
      category: null,
      legal_form: 'ooo',
      unp: null,
      reg_number: null,
      address: null,
      legal_address: null,
      director_name: null,
      lat: null,
      lng: null,
      description: null,
      phone: null,
      website: null,
    } as any,
  })

  const [name, nameAttrs] = defineField('name')
  const [category] = defineField('category')
  const [legalForm] = defineField('legal_form')
  const [unp, unpAttrs] = defineField('unp')
  const [regNumber] = defineField('reg_number')
  const [address] = defineField('address')
  const [legalAddress, legalAddressAttrs] = defineField('legal_address')
  const [directorName] = defineField('director_name')
  const [lat] = defineField('lat')
  const [lng] = defineField('lng')
  const [description] = defineField('description')
  const [phone] = defineField('phone')
  const [website] = defineField('website')

  const stepValid = computed(() => {
    if (step.value === 0) {
      return String(values.name ?? '').trim().length >= 2 && !!values.legal_form
    }
    if (step.value === 1) {
      return /^\d{9}$/.test(String(values.unp ?? '')) && String(values.legal_address ?? '').trim().length > 3
    }
    return true
  })

  function next(): void {
    if (!stepValid.value || step.value >= 2) {
      return
    }
    step.value += 1
  }

  function back(): void {
    if (step.value <= 0) {
      return
    }
    step.value -= 1
  }

  const finish = handleSubmit(async (vals) => {
    const saved = await store.save(vals as unknown as BusinessProfilePayload)
    if (!saved) {
      toast.add({ severity: 'error', summary: 'Ошибка', detail: store.error ?? 'Проверьте поля', life: 4000 })
      return
    }
    const sent = await store.submit()
    if (sent) {
      toast.add({ severity: 'success', summary: 'Готово', detail: 'Компания отправлена на проверку', life: 3500 })
    }
    router.visit('/business')
  })

  return {
    step,
    errors,
    values,
    name,
    nameAttrs,
    category,
    legalForm,
    unp,
    unpAttrs,
    regNumber,
    address,
    legalAddress,
    legalAddressAttrs,
    directorName,
    lat,
    lng,
    description,
    phone,
    website,
    stepValid,
    next,
    back,
    finish,
    setValues,
    store,
    legalFormOptions: LEGAL_FORM_OPTIONS,
  }
}
