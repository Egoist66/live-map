import { computed, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useForm } from 'vee-validate'
import { useToast } from 'primevue/usetoast'
import { businessSchema } from '@/validation/schemas/business.schema'
import { useBusinessStore } from '@/stores/business'
import type { BusinessProfilePayload } from '@/types/entities/Business'

export interface MissingBusinessField {
  key: string
  label: string
  step: number
}

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
  const loaded = ref(false)

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

  /**
   * Обязательные реквизиты, которых не хватает в профиле.
   *
   * Всё, что уже дали при регистрации (название, форма, УНП,
   * юрадрес, телефон), подставлено заранее — показываем
   * только недостающее, чтобы дозаполнить.
   */
  const missing = computed<MissingBusinessField[]>(() => {
    const list: MissingBusinessField[] = []

    if (String(values.name ?? '').trim().length < 2) {
      list.push({ key: 'name', label: 'Название компании', step: 0 })
    }
    if (!values.legal_form) {
      list.push({ key: 'legal_form', label: 'Форма собственности', step: 0 })
    }
    if (!/^\d{9}$/.test(String(values.unp ?? ''))) {
      list.push({ key: 'unp', label: 'УНП (9 цифр)', step: 1 })
    }
    if (String(values.legal_address ?? '').trim().length <= 3) {
      list.push({ key: 'legal_address', label: 'Юридический адрес', step: 1 })
    }

    return list
  })

  const isComplete = computed(() => loaded.value && missing.value.length === 0)

  /**
   * Перейти к шагу с недостающим полем.
   * @param field поле из missing
   */
  function goToMissing(field: MissingBusinessField): void {
    step.value = field.step
  }

  /**
   * Подтянуть известные реквизиты из профиля (с регистрации)
   * и встать на первый незаполненный шаг.
   */
  async function load(): Promise<void> {
    try {
      await store.loadAll()
      const profile = store.profile
      if (profile) {
        setValues({
          name: profile.name ?? '',
          category: profile.category ?? null,
          legal_form: profile.legal_form ?? 'ooo',
          unp: profile.unp ?? null,
          reg_number: profile.reg_number ?? null,
          address: profile.address ?? null,
          legal_address: profile.legal_address ?? null,
          director_name: profile.director_name ?? null,
          lat: profile.lat ?? null,
          lng: profile.lng ?? null,
          description: profile.description ?? null,
          phone: profile.phone ?? null,
          website: profile.website ?? null,
        })
      }
    } catch {} finally {
      loaded.value = true
    }

    const firstMissing = missing.value[0]
    if (firstMissing) {
      step.value = firstMissing.step
    }
  }

  onMounted(() => {
    void load()
  })

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
    router.visit('/cabinet')
  })

  return {
    step,
    loaded,
    missing,
    isComplete,
    goToMissing,
    load,
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
