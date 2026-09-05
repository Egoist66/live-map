import { ref, computed, onUnmounted } from 'vue'
import { formatDateTime } from '@/utils/date'

function fmtLeft(ms: number): string {
  if (ms <= 0) return 'время вышло'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'меньше минуты'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) {
    const rm = m % 60
    return rm ? `${h} ч ${rm} мин` : `${h} ч`
  }
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d} д ${rh} ч` : `${d} д`
}

export function usePinLifetime(getPin: () => any) {
  const now = ref(Date.now())
  let timer: any = null
  timer = setInterval(() => { now.value = Date.now() }, 30000)
  try {
    onUnmounted(() => { if (timer) clearInterval(timer) })
  } catch {}

  const isScheduled = computed(() => {
    const p = getPin()
    return p?.status === 'scheduled' || !!p?.is_scheduled
  })
  const isEternal = computed(() => !getPin()?.expires_at && !isScheduled.value)
  const totalMs = computed(() => {
    const p = getPin()
    if (!p?.created_at || !p?.expires_at) return 0
    return new Date(p.expires_at).getTime() - new Date(p.created_at).getTime()
  })
  const leftMs = computed(() => {
    const p = getPin()
    if (!p?.expires_at) return Infinity
    return new Date(p.expires_at).getTime() - now.value
  })
  const percent = computed(() => {
    if (isEternal.value) return 1
    if (!totalMs.value || totalMs.value <= 0) return 0
    return Math.min(1, Math.max(0, leftMs.value / totalMs.value))
  })
  const expired = computed(() => !isEternal.value && !isScheduled.value && leftMs.value <= 0)
  const label = computed(() => {
    const p = getPin()
    if (!p) return ''
    if (isScheduled.value) return p.publish_at ? `Опубликуется ${formatDateTime(p.publish_at)}` : 'Запланирован'
    if (isEternal.value) return '∞ бессрочно'
    if (leftMs.value <= 0) return 'Время вышло'
    return `Осталось ${fmtLeft(leftMs.value)}`
  })
  const tone = computed(() => (percent.value > 0.5 ? 'good' : percent.value > 0.2 ? 'warn' : 'bad'))

  return { isScheduled, isEternal, expired, percent, leftMs, label, tone }
}
