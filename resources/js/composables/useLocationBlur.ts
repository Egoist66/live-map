import { ref, computed, watch } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'

export type BlurPrecision = 'blur_200' | 'exact' | 'district' | 'custom'

export const BLUR_OPTIONS: { v: BlurPrecision; l: string; d: string }[] = [
  { v: 'exact', l: 'Точное', d: 'без сдвига' },
  { v: 'blur_200', l: '200 м', d: 'по умолчанию' },
  { v: 'custom', l: 'Своё', d: 'ползунок' },
  { v: 'district', l: 'Район', d: '~1,2 км' },
]

export const BLUR_MAX_METERS = 5000

export function blurLabelFor(precision?: string | null, meters?: number | null): string {
  if (precision === 'exact') return 'Точное место'
  if (precision === 'district') return 'Район ~1,2 км'
  if (precision === 'custom') return `Своё · ${Number(meters ?? 200)} м`
  return '200 м'
}

export function useLocationBlur() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const precision = ref<BlurPrecision>((authUser.value?.default_location_precision as BlurPrecision) || 'blur_200')
  const blurMeters = ref<number>(Number(authUser.value?.default_blur_meters ?? 200))
  const saving = ref(false)
  const saved = ref(false)

  watch(authUser, (u) => {
    if (!u) return
    if (!saving.value) {
      precision.value = (u.default_location_precision as BlurPrecision) || 'blur_200'
      blurMeters.value = Number(u.default_blur_meters ?? 200)
    }
  })

  const blurLabel = computed(() => blurLabelFor(precision.value, blurMeters.value))
  const dirty = computed(
    () => precision.value !== ((authUser.value?.default_location_precision as string) || 'blur_200') || blurMeters.value !== Number(authUser.value?.default_blur_meters ?? 200),
  )

  function setPrecision(v: BlurPrecision) {
    precision.value = v
    saved.value = false
    save()
  }

  function setMeters(v: number) {
    blurMeters.value = Math.max(0, Math.min(BLUR_MAX_METERS, Math.round(v)))
    saved.value = false
  }

  function commitMeters() {
    if (dirty.value) save()
  }

  function save() {
    const u = authUser.value
    if (!u || saving.value) return
    saving.value = true
    router.patch(
      route('profile.update'),
      { name: u.name, email: u.email, default_location_precision: precision.value, default_blur_meters: blurMeters.value } as any,
      {
        preserveScroll: true,
        onSuccess: () => { saved.value = true; toast?.add({ severity: 'success', summary: 'Размытие сохранено', life: 2000 }) },
        onError: (e: any) => { toast?.add({ severity: 'error', summary: 'Ошибка', detail: Object.values(e || {}).flat().join(', ') || 'Не удалось сохранить', life: 3000 }) },
        onFinish: () => { saving.value = false },
      },
    )
  }

  function applyToPinCreate(pinCreate: any) {
    try {
      pinCreate.setValues?.({ location_precision: precision.value, blur_meters: blurMeters.value } as any)
    } catch {}
  }

  return { precision, blurMeters, blurLabel, dirty, saving, saved, setPrecision, setMeters, commitMeters, save, applyToPinCreate, options: BLUR_OPTIONS }
}
