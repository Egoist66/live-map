import { ref, computed, watch } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { route } from '@/route'
import { useToast } from 'primevue/usetoast'
import { planOf } from '@/composables/usePlanLimits'

export const GEO_BLUR_DEFAULT = 300
export const GEO_BLUR_MAX = 5000

export const GEO_BLUR_OPTIONS: { v: number; l: string; d: string; pro?: boolean }[] = [
  { v: 0, l: 'Точное', d: 'без сдвига' },
  { v: 300, l: '300 м', d: 'по умолчанию' },
  { v: 1000, l: '1 км', d: '' },
  { v: 5000, l: '5 км', d: 'PRO', pro: true },
]

export function formatBlurMeters(meters: number): string {
  if (meters >= 1000) {
    const s = (meters / 1000).toFixed(1).replace('.', ',').replace(',0', '')
    return `${s} км`
  }
  return `${meters} м`
}

export function geoBlurLabel(meters?: number | null): string {
  const m = Number(meters ?? GEO_BLUR_DEFAULT)
  if (m <= 0) return 'Точное место'
  return `~${formatBlurMeters(m)}`
}

export function blurCoords(lat: number, lng: number, meters: number): [number, number] {
  if (!meters || meters <= 0) return [lat, lng]
  const r = meters / 111300
  const u = Math.random()
  const v = Math.random()
  const w = r * Math.sqrt(u)
  const t = 2 * Math.PI * v
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1
  return [Number((lat + w * Math.sin(t)).toFixed(7)), Number((lng + (w * Math.cos(t)) / cosLat).toFixed(7))]
}

export function pinBlurInfo(p: any): { blurred: boolean; label: string; hint: string } | null {
  if (!p) return null
  if (p.blur_hint) return { blurred: !!p.is_blurred, label: p.blur_label || '', hint: p.blur_hint }
  const precision = p.location_precision
  if (!precision || precision === 'exact') return null
  const meters = precision === 'district' ? 1200 : Number(p?.meta?.blur_meters ?? 200)
  if (meters <= 0) return null
  const label = `~${formatBlurMeters(meters)}`
  return { blurred: true, label, hint: `Виртуальная точка · сдвинута примерно на ${formatBlurMeters(meters)} — это не точное местоположение` }
}

export function useLocationBlur() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const blurMeters = ref<number>(Number(authUser.value?.default_blur_meters ?? GEO_BLUR_DEFAULT))
  const saving = ref(false)
  const saved = ref(false)

  const isPro = computed(() => {
    const u = authUser.value
    return !!u?.is_admin || u?.role === 'admin' || u?.role === 'moderator' || ['pro', 'premium', 'business'].includes(planOf(u))
  })
  const canUse5km = computed(() => isPro.value)

  watch(authUser, (u) => {
    if (!u || saving.value) return
    blurMeters.value = Number(u.default_blur_meters ?? GEO_BLUR_DEFAULT)
  })

  const blurLabel = computed(() => geoBlurLabel(blurMeters.value))
  const dirty = computed(() => blurMeters.value !== Number(authUser.value?.default_blur_meters ?? GEO_BLUR_DEFAULT))

  function setMeters(v: number) {
    const next = Math.max(0, Math.min(GEO_BLUR_MAX, Math.round(v)))
    if (next > 1000 && !canUse5km.value) {
      toast?.add({ severity: 'warn', summary: 'Только Pro', detail: 'Размытие 5 км доступно на тарифе Pro/Business', life: 3000 })
      return
    }
    blurMeters.value = next
    saved.value = false
    save()
  }

  function save() {
    const u = authUser.value
    if (!u || saving.value) return
    saving.value = true
    router.patch(
      route('profile.update'),
      { name: u.name, email: u.email, default_blur_meters: blurMeters.value, default_location_precision: blurMeters.value <= 0 ? 'exact' : 'custom' } as any,
      {
        preserveScroll: true,
        onSuccess: () => { saved.value = true; toast?.add({ severity: 'success', summary: 'Размытие сохранено', life: 2000 }) },
        onError: (e: any) => { toast?.add({ severity: 'error', summary: 'Ошибка', detail: Object.values(e || {}).flat().join(', ') || 'Не удалось сохранить', life: 3000 }) },
        onFinish: () => { saving.value = false },
      },
    )
  }

  return { blurMeters, blurLabel, dirty, saving, saved, isPro, canUse5km, setMeters, save, options: GEO_BLUR_OPTIONS }
}
