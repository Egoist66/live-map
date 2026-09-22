import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { useToast } from 'primevue/usetoast'
import { businessSchema } from '@/validation/schemas/business.schema'
import { useBusinessStore } from '@/stores/business'
import type { BusinessProfilePayload } from '@/types/entities/Business'

let realtimeBound = false

/**
 * Форма профиля бизнеса в кабинете (vee-validate + zod, РБ-поля).
 *
 * Стор — Pinia (useBusinessStore), realtime-подписка на
 * private `user.{id}` событие `business.verified` — синглтон.
 *
 * @returns поля формы, стор и действия save/submit
 * @example const { store, submitForm } = useBusinessProfile()
 */
export function useBusinessProfile() {
  const store = useBusinessStore()
  const toast = useToast()
  const userId = ref<number | null>(null)

  const { defineField, handleSubmit, errors, values, setValues, isSubmitting } = useForm({
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
  const [legalAddress] = defineField('legal_address')
  const [directorName] = defineField('director_name')
  const [lat] = defineField('lat')
  const [lng] = defineField('lng')
  const [description] = defineField('description')
  const [phone, phoneAttrs] = defineField('phone')
  const [website] = defineField('website')

  const canSubmit = computed(() => {
    const unpValue = String(values.unp ?? '')
    const legalAddressValue = String(values.legal_address ?? '').trim()
    return /^\d{9}$/.test(unpValue) && legalAddressValue.length > 3
  })

  const verificationLabel = computed(() => {
    const status = store.profile?.verification_status
    if (status === 'verified') return 'Проверено'
    if (status === 'pending') return 'На проверке'
    if (status === 'rejected') return 'Отклонено'
    return 'Не проверен'
  })

  /**
   * Подтянуть профиль в форму после загрузки стора.
   */
  async function load(): Promise<void> {
    await store.loadAll()
    if (store.profile) {
      setValues({ ...store.profile })
    }
  }

  const submitForm = handleSubmit(async (vals) => {
    const ok = await store.save(vals as unknown as BusinessProfilePayload)
    if (ok) {
      toast.add({ severity: 'success', summary: 'Сохранено', detail: 'Профиль компании обновлён', life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: 'Ошибка', detail: store.error ?? 'Не получилось сохранить', life: 4000 })
    }
  })

  /**
   * Отправить на проверку по УНП.
   */
  async function submitVerification(): Promise<void> {
    const ok = await store.submit()
    if (ok) {
      toast.add({ severity: 'success', summary: 'Отправлено', detail: 'Заявка на проверку принята', life: 3500 })
    } else {
      toast.add({ severity: 'warn', summary: 'Проверьте реквизиты', detail: store.error ?? 'Нужны УНП и юрадрес', life: 4500 })
    }
  }

  function handleVerified(event: { business?: Record<string, unknown> }): void {
    if (event?.business) {
      store.applyRealtime(event.business as unknown as Parameters<typeof store.applyRealtime>[0])
      toast.add({ severity: 'success', summary: 'Компания проверена', detail: 'Бейдж «Проверено» включён', life: 5000 })
    } else {
      void store.refreshDashboard()
    }
  }

  /**
   * Живое обновление верификации (realtime bus + websocket).
   * @param uid id владельца
   */
  function bindRealtime(uid: number): void {
    userId.value = uid
    if (realtimeBound) {
      return
    }
    realtimeBound = true
    const tryBind = (): void => {
      const echo = (window as unknown as { Echo?: { private: (ch: string) => { listen: (ev: string, cb: (e: never) => void) => unknown } } }).Echo
      if (!echo) {
        window.setTimeout(tryBind, 2500)
        return
      }
      try {
        echo.private(`user.${uid}`).listen('.business.verified', handleVerified as (e: never) => void)
      } catch {}
    }
    tryBind()
  }

  onMounted(() => {
    void load()
  })

  onUnmounted(() => {})

  return {
    store,
    errors,
    values,
    isSubmitting,
    name,
    nameAttrs,
    category,
    legalForm,
    unp,
    unpAttrs,
    regNumber,
    address,
    legalAddress,
    directorName,
    lat,
    lng,
    description,
    phone,
    phoneAttrs,
    website,
    canSubmit,
    verificationLabel,
    load,
    submitForm,
    submitVerification,
    bindRealtime,
    setValues,
  }
}
