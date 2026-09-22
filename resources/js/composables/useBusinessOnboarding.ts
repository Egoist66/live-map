import { computed, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useForm } from 'vee-validate'
import { useToast } from 'primevue/usetoast'
import { businessSchema } from '@/validation/schemas/business.schema'
import { forwardGeocodePlace } from '@/services/geo.api'
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

export const BUSINESS_WEEK_DAYS = [
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Вс' },
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

  /**
   * Часы работы по дням недели: пусто — выходной.
   */
  const hours = ref<Record<string, string>>({ mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' })

  /**
   * Часы без пустых дней для сохранения.
   */
  function cleanHours(): Record<string, string> | null {
    const out: Record<string, string> = {}
    for (const day of BUSINESS_WEEK_DAYS) {
      const value = String(hours.value[day.key] ?? '').trim().slice(0, 64)
      if (value !== '') {
        out[day.key] = value
      }
    }
    return Object.keys(out).length > 0 ? out : null
  }

  const { defineField, handleSubmit, errors, values, setValues } = useForm({
    validationSchema: businessSchema,
    initialValues: {
      name: '',
      brand: null,
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
      services: null,
      phone: null,
      website: null,
    } as any,
  })

  const [name, nameAttrs] = defineField('name')
  const [brand] = defineField('brand')
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
  const [services] = defineField('services')
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

  /** Идёт ли поиск координат по адресу. */
  const geocoding = ref(false)

  /**
   * Подпись текущих координат точки.
   */
  const coordsLabel = computed(() => {
    const latNum = Number(values.lat)
    const lngNum = Number(values.lng)
    if (Number.isFinite(latNum) && Number.isFinite(lngNum) && String(values.lat ?? '') !== '' && String(values.lng ?? '') !== '') {
      return `📍 ${latNum.toFixed(5)}, ${lngNum.toFixed(5)} — точка на карте задана`
    }
    return 'Точка на карте не задана'
  })

  /**
   * Найти координаты по фактическому адресу (Nominatim, с кэшем).
   *
   * Широту/долготу руками никто не вводит: владелец пишет адрес
   * (или жмёт «как юр. адрес»), координаты считаются автоматом
   * и едут в lat/lng — дальше пригодятся карте и поиску.
   *
   * @returns true когда точка найдена и подставлена
   */
  async function detectCoords(): Promise<boolean> {
    const rawAddress = String(values.address ?? '').trim()
    const rawLegal = String(values.legal_address ?? '').trim()
    const query = rawAddress !== '' ? rawAddress : rawLegal
    if (query === '' || geocoding.value) {
      return false
    }
    geocoding.value = true
    try {
      const found = await forwardGeocodePlace(`${query}, Беларусь`)
        ?? await forwardGeocodePlace(query)
      if (!found) {
        toast.add({ severity: 'warn', summary: 'Не нашли адрес', detail: 'Уточни улицу и дом — например «г. Минск, ул. Ленина, 1»', life: 4500 })
        return false
      }
      lat.value = String(found.lat)
      lng.value = String(found.lng)
      toast.add({ severity: 'success', summary: 'Точка найдена', detail: `${found.lat.toFixed(5)}, ${found.lng.toFixed(5)}`, life: 2500 })
      return true
    } finally {
      geocoding.value = false
    }
  }

  /**
   * Тихий поиск координат при уходе с поля адреса.
   *
   * Срабатывает только когда точки ещё нет — уже заданную
   * вручную найденную точку не перезатираем.
   */
  async function maybeDetectCoords(): Promise<void> {
    if (String(values.lat ?? '') !== '' && String(values.lng ?? '') !== '') {
      return
    }
    if (String(values.address ?? '').trim() === '') {
      return
    }
    await detectCoords()
  }

  /**
   * Подставить юр. адрес в фактический и найти координаты.
   */
  async function useLegalAddressAsPoint(): Promise<void> {
    const rawLegal = String(values.legal_address ?? '').trim()
    if (rawLegal === '') {
      toast.add({ severity: 'warn', summary: 'Юр. адрес пуст', detail: 'Заполни его на шаге «Реквизиты РБ»', life: 3500 })
      return
    }
    address.value = rawLegal
    await detectCoords()
  }

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
        const savedHours = (profile as { working_hours?: Record<string, string> | null }).working_hours
        if (savedHours && typeof savedHours === 'object') {
          for (const day of BUSINESS_WEEK_DAYS) {
            hours.value[day.key] = String(savedHours[day.key] ?? '')
          }
        }
        setValues({
          name: profile.name ?? '',
          brand: profile.brand ?? null,
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
          services: (profile as { services?: string | null }).services ?? null,
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
    if (store.profile?.verification_status === 'pending') {
      toast.add({ severity: 'warn', summary: 'Уже на проверке', detail: 'Заявка уже отправлена — дождитесь решения модерации', life: 4500 })
      router.visit('/cabinet')
      return
    }
    const payload = { ...(vals as Record<string, unknown>), working_hours: cleanHours() }
    const saved = await store.save(payload as unknown as BusinessProfilePayload)
    if (!saved) {
      toast.add({ severity: 'error', summary: 'Ошибка', detail: store.error ?? 'Проверьте поля', life: 4000 })
      return
    }
    const sent = await store.submit()
    if (sent) {
      toast.add({ severity: 'success', summary: 'Готово', detail: 'Компания отправлена на проверку', life: 3500 })
    } else {
      const detail = store.error ?? 'Проверьте поля'
      const alreadyPending = /уже на проверке/i.test(detail)
      toast.add({ severity: alreadyPending ? 'warn' : 'error', summary: alreadyPending ? 'Уже на проверке' : 'Не отправлено', detail, life: 4500 })
    }
    router.visit('/cabinet')
  })

  return {
    step,
    loaded,
    hours,
    weekDays: BUSINESS_WEEK_DAYS,
    missing,
    isComplete,
    goToMissing,
    load,
    errors,
    values,
    name,
    nameAttrs,
    brand,
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
    services,
    phone,
    website,
    stepValid,
    next,
    back,
    finish,
    geocoding,
    coordsLabel,
    detectCoords,
    maybeDetectCoords,
    useLegalAddressAsPoint,
    setValues,
    store,
    legalFormOptions: LEGAL_FORM_OPTIONS,
  }
}
