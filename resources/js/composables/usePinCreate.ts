import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { createPinSchema } from '@/validation/schemas/createPin.schema'
import { usePinsStore } from '@/stores/pins'
import { usePinLimit } from '@/composables/usePinLimit'
import { useCustomCategories } from '@/composables/useCustomCategories'
import { useResidence } from '@/composables/useResidence'
import { useHomeZoneGuard } from '@/composables/useHomeZoneGuard'
import { usePage } from '@inertiajs/vue3'
import { PIN_CATEGORIES } from '@/composables/usePins'
import { useSosConfirm } from '@/composables/useSosConfirm'
import { useToast } from 'primevue/usetoast'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(v: string): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function usePinCreate(onSuccess?: () => void) {
  const store = usePinsStore()
  const toast = useToast()
  const showCoords = ref(false)
  const scheduleEnabled = ref(false)
  const limitInfo = usePinLimit()
  const customCats = useCustomCategories()
  const page = usePage()
  const residence = useResidence(() => (page.props.auth as any)?.user)
  const zoneGuard = useHomeZoneGuard()
  const sos = useSosConfirm()
  const builtInValues = (PIN_CATEGORIES as unknown as any[]).map((c) => c.v)

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
    validationSchema: createPinSchema,
    initialValues: {
      title: '',
      body: '',
      category: 'announcement',
      gender_audience: 'all',
      latitude: 0,
      longitude: 0,
      location_precision: 'exact',
      is_anonymous: false,
      radius_meters: 1000,
      publish_at: null,
    } as any,
  })

  const [title, titleAttrs] = defineField('title')
  const [body] = defineField('body')
  const [category] = defineField('category')
  const [gender_audience] = defineField('gender_audience')
  const [latitude] = defineField('latitude')
  const [longitude] = defineField('longitude')
  const [location_precision] = defineField('location_precision')
  const [is_anonymous] = defineField('is_anonymous')
  const [radius_meters] = defineField('radius_meters')
  const [publish_at] = defineField('publish_at')

  const minScheduleLocal = computed(() => toLocalInput(new Date(Date.now() + 5 * 60_000)))
  const maxScheduleLocal = computed(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return toLocalInput(d)
  })

  const isScheduled = computed(() => scheduleEnabled.value && !!publish_at.value && !!fromLocalInput(publish_at.value as any))

  const scheduleLabel = computed(() => {
    if (!isScheduled.value) return ''
    const d = fromLocalInput(publish_at.value as any)
    if (!d) return ''
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  })

  function setCoords(lat: number, lng: number) {
    setValues({ latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) } as any)
  }

  function toggleSchedule(on?: boolean) {
    scheduleEnabled.value = on ?? !scheduleEnabled.value
    if (!scheduleEnabled.value) setValues({ publish_at: null } as any)
    else if (!publish_at.value) {
      const d = new Date(Date.now() + 60 * 60_000)
      setValues({ publish_at: toLocalInput(d) } as any)
    }
  }

  function applyPreset(kind: 'hour' | 'evening' | 'morning') {
    const now = new Date()
    let d = new Date(now)
    if (kind === 'hour') d = new Date(now.getTime() + 60 * 60_000)
    if (kind === 'evening') {
      d.setHours(18, 0, 0, 0)
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
    }
    if (kind === 'morning') {
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
    }
    scheduleEnabled.value = true
    setValues({ publish_at: toLocalInput(d) } as any)
  }

  const error = ref<unknown>(null)

  const submit = handleSubmit(async (vals: any) => {
    error.value = null
    try {
      const cat = String(vals.category ?? '').toLowerCase()
      if (cat && !builtInValues.includes(cat) && !customCats.canCreate.value) {
        const err: any = { response: { status: 403, data: { message: 'Свои категории доступны на тарифе Pro и выше.' } } }
        error.value = err
        throw err
      }
      await limitInfo.refresh()
      if (limitInfo.isExceeded.value) {
        const err: any = { response: { status: 429, data: { message: limitInfo.warning.value } } }
        error.value = err
        throw err
      }
      const payload: any = { ...vals, sos_confirmed: sos.sosConfirmed.value }
      let livePos: { lat: number; lng: number } | null = null
      try {
        const liveRaw = localStorage.getItem('live-map:last-pos')
        const live = liveRaw ? JSON.parse(liveRaw) : null
        if (live && Number.isFinite(Number(live.lat)) && Number.isFinite(Number(live.lng))) livePos = { lat: Number(live.lat), lng: Number(live.lng) }
      } catch {}
      if (livePos) {
        payload.user_lat = livePos.lat
        payload.user_lng = livePos.lng
      }
      const zone = zoneGuard.check(Number(payload.latitude), Number(payload.longitude), livePos)
      if (!zone.ok) {
        const err: any = { response: { status: 422, data: { message: zone.message } } }
        error.value = err
        throw err
      }
      const guard = await residence.assertPinInHomeCountry(Number(payload.latitude), Number(payload.longitude))
      if (!guard.ok) {
        const err: any = { response: { status: 422, data: { message: guard.message } } }
        error.value = err
        throw err
      }
      if (scheduleEnabled.value && payload.publish_at) {
        const d = fromLocalInput(payload.publish_at)
        if (!d || d.getTime() <= Date.now()) throw { response: { data: { message: 'Выбери будущие дату и время' } } }
        payload.publish_at = d.toISOString()
      } else {
        payload.publish_at = null
      }
      const pin = await store.createPin(payload)
      const scheduled = (pin as any)?.is_scheduled || (pin as any)?.status === 'scheduled'
      toast.add({ severity: 'success', summary: scheduled ? `Запланирован на ${scheduleLabel.value}` : 'Пин создан', life: 2500 })
      scheduleEnabled.value = false
      sos.resetSos()
      resetForm({ values: { ...vals, title: '', body: '', publish_at: null, gender_audience: (vals as any).gender_audience ?? 'all' } as any })
      try { await limitInfo.refresh() } catch {}
      onSuccess?.()
    } catch (e: any) {
      error.value = e
      const status = e?.response?.status
      const serverMsg = e?.response?.data?.message || ''
      const isLimit = status === 429 || /лимит/i.test(serverMsg)
      if (isLimit) {
        const msg = serverMsg || limitInfo.warning.value || 'Лимит free тарифа: максимум 3 живых пина'
        const isSosLimit = /sos/i.test(serverMsg)
        toast.add({ severity: 'warn', summary: isSosLimit ? 'Лимит SOS' : 'Лимит пинов', detail: msg, life: 5000 })
      } else if (status === 422 && (/стран/i.test(serverMsg) || /зон/i.test(serverMsg))) {
        toast.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: serverMsg, life: 5000 })
      } else {
        toast.add({ severity: 'error', summary: serverMsg || 'Ошибка создания', life: 3000 })
      }
      throw e
    }
  })

  return {
    store,
    sos,
    selectCategory,
    limitExceeded: limitInfo.isExceeded,
    limitWarning: limitInfo.warning,
    limitRemaining: limitInfo.remaining,
    limitUsed: limitInfo.used,
    limitStatus: limitInfo.statusText,
    isUnlimited: limitInfo.isUnlimited,
    ttlLabel: limitInfo.ttlLabel,
    refreshLimit: limitInfo.refresh,
    title,
    titleAttrs,
    body,
    category,
    gender_audience,
    latitude,
    longitude,
    location_precision,
    is_anonymous,
    radius_meters,
    publish_at,
    values,
    errors,
    showCoords,
    creating: store.creating,
    error,
    setCoords,
    submit,
    setValues,
    resetForm,
    scheduleEnabled,
    isScheduled,
    scheduleLabel,
    minScheduleLocal,
    maxScheduleLocal,
    toggleSchedule,
    applyPreset,
  }
}
