import { ref, computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { adminApi } from '@/services/admin.api'
import { useBadgeStore } from '@/stores/badges'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

export type ReportFilter = 'pending' | 'resolved' | 'dismissed' | 'all'

const reports = ref<any[]>([])
const pendingCount = ref(0)
const loading = ref(false)
const filter = ref<ReportFilter>('pending')
const actingId = ref<number | null>(null)
const error = ref<string | null>(null)
let busBound = false
let inited = false
let toast: any = null

function readIsAdmin(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin'
  } catch { return false }
}

function getUid(): number {
  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
  } catch {}
  return Number((window as any).userId || 0)
}

function onReport(e: any) {
  const r = e?.report
  if (!r?.id) return
  if (filter.value === 'pending' || filter.value === 'all') {
    if (!reports.value.some((x) => x.id === r.id)) reports.value = [r, ...reports.value].slice(0, 30)
  }
  pendingCount.value += 1
  try { useBadgeStore().incReports() } catch {}
}

function subscribe() {
  try {
    const uid = getUid()
    if (!uid) return
    ensureUserChannel()
    if (busBound) return
    busBound = true
    busOn('user:report.created', onReport)
    busOn('notify:report', onReport)
  } catch {}
}

async function refresh() {
  if (!readIsAdmin()) return
  loading.value = true
  error.value = null
  try {
    const data: any = await adminApi.reports(filter.value)
    reports.value = data?.reports?.data ?? []
    pendingCount.value = Number(data?.pending_count ?? 0)
    try { useBadgeStore().setReports(pendingCount.value) } catch {}
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Не удалось загрузить жалобы'
  } finally {
    loading.value = false
  }
}

async function resolve(id: number, status: 'resolved' | 'dismissed') {
  actingId.value = id
  try {
    await adminApi.resolveReport(id, status)
    const item = reports.value.find((x) => x.id === id)
    reports.value = reports.value.filter((x) => x.id !== id)
    if (item?.status === 'pending' || filter.value === 'pending') {
      pendingCount.value = Math.max(0, pendingCount.value - 1)
      try { useBadgeStore().decReports() } catch {}
    }
    toast?.add({ severity: 'success', summary: status === 'resolved' ? 'Жалоба принята' : 'Жалоба отклонена', life: 2000 })
  } catch (e: any) {
    toast?.add({ severity: 'error', summary: e?.response?.data?.message || 'Не удалось обновить', life: 3000 })
  } finally {
    actingId.value = null
  }
}

function setFilter(f: ReportFilter) {
  filter.value = f
  void refresh()
}

function goReports() {
  router.visit('/settings?tab=admin')
}

function init() {
  if (inited) return
  inited = true
  try { toast = useToast() } catch { toast = null }
  if (!readIsAdmin()) return
  void refresh()
  subscribe()
  window.addEventListener('focus', subscribe)
}

/**
 * Сбросить жалобы при смене аккаунта.
 */
export function resetAdminReports(): void {
  try {
    leaveUserChannel()
  } catch {}
  inited = false
  reports.value = []
  pendingCount.value = 0
  error.value = null
}

export function useAdminReports() {
  const hasData = computed(() => reports.value.length > 0)
  return { reports, pendingCount, loading, filter, actingId, error, hasData, refresh, resolve, setFilter, goReports, init, subscribe }
}
