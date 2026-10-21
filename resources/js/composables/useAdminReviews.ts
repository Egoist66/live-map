import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { adminApi } from '@/services/admin.api'
import { useBadgeStore } from '@/stores/badges'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'
import { isAdminBlockedClient } from '@/composables/useAdminClientGate'

export type AdminReviewFilter = 'pending' | 'approved' | 'rejected' | 'all'

/**
 * Один отзыв из очереди модерации ULove.
 *
 * author/target — мини-профили (id, name, avatar_url, profile_slug).
 */
export interface AdminReviewItem {
  id: number
  rating: number
  body: string | null
  status: AdminReviewFilter
  created_at: string | null
  moderated_at: string | null
  author: { id: number; name: string; avatar_url: string | null; profile_slug: string | null } | null
  target: { id: number; name: string; avatar_url: string | null; profile_slug: string | null } | null
}

const reviews = ref<AdminReviewItem[]>([])
const pendingCount = ref(0)
const loading = ref(false)
const filter = ref<AdminReviewFilter>('pending')
const actingId = ref<number | null>(null)
const error = ref<string | null>(null)
let busBound = false
let inited = false
let toast: any = null

/**
 * Может ли текущий пользователь модерировать отзывы.
 *
 * Одобрение/отклонение доступно админам и модераторам
 * (админ — тоже модератор).
 */
function readCanModerate(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin' || u?.role === 'moderator'
  } catch { return false }
}

function getUid(): number {
  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
  } catch {}
  return Number((window as any).userId || 0)
}

/**
 * Новый отзыв поставлен в очередь: добавить карточку наверх
 * и поднять бейдж-счётчик в боковом меню.
 */
function onReviewCreated(e: any) {
  const n = e?.notification
  const raw = n?.data?.review
  if (!n?.id || !raw?.id) return
  if (filter.value === 'pending' || filter.value === 'all') {
    const item: AdminReviewItem = { ...raw, status: raw.status || 'pending' }
    if (!reviews.value.some((x) => x.id === item.id)) reviews.value = [item, ...reviews.value]
  }
  pendingCount.value += 1
  try { useBadgeStore().incReviews() } catch {}
}

function subscribe() {
  try {
    const uid = getUid()
    if (!uid) return
    ensureUserChannel()
    if (busBound) return
    busBound = true
    busOn('user:notification.created', (e: any) => {
      const n = e?.notification
      if (n?.id && n.type === 'review.created') onReviewCreated({ notification: n })
    })
  } catch {}
}

/**
 * Загрузить очередь по фильтру и синхронизировать бейдж.
 */
async function refresh() {
  if (!readCanModerate()) return
  loading.value = true
  error.value = null
  try {
    const data: any = await adminApi.datingReviews(filter.value, 15)
    reviews.value = Array.isArray(data?.reviews) ? data.reviews : []
    pendingCount.value = Number(data?.pending_count ?? 0)
    try { useBadgeStore().setReviews(pendingCount.value) } catch {}
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Не удалось загрузить отзывы'
  } finally {
    loading.value = false
  }
}

/**
 * Вердикт по отзыву: approved — публиковать, rejected — отклонить.
 *
 * Бэк прислал обновлённую карточку — показываем вердикт в списке
 * (approved/rejected светятся по Tag). Pending-счётчик и бейдж
 * уменьшаем, если решали именно pending-отзыв.
 */
async function resolve(id: number, status: 'approved' | 'rejected') {
  actingId.value = id
  try {
    const data: any = await adminApi.resolveDatingReview(id, status)
    const item = data?.review as AdminReviewItem | undefined
    const index = reviews.value.findIndex((x) => x.id === id)
    const wasPending = index >= 0 ? reviews.value[index]?.status === 'pending' : false

    if (index >= 0 && item) {
      const next = [...reviews.value]
      next[index] = item
      reviews.value = next
    }

    if (wasPending) {
      pendingCount.value = Math.max(0, pendingCount.value - 1)
      try { useBadgeStore().decReviews() } catch {}
    }

    toast?.add({
      severity: 'success',
      summary: status === 'approved' ? 'Отзыв одобрен' : 'Отзыв отклонён',
      detail: status === 'approved' ? 'Публикуем в профиле и свайпах' : 'Автор получит уведомление',
      life: 2500,
    })
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Не удалось сохранить решение'
    toast?.add({ severity: 'error', summary: e?.response?.data?.message || 'Не удалось обновить', life: 3000 })
  } finally {
    actingId.value = null
  }
}

function setFilter(f: AdminReviewFilter) {
  filter.value = f
  void refresh()
}

/**
 * Забирает ToastService, пока мы в setup-контексте.
 *
 * `init()` едет в idle-колбэке вне setup: тамошний `useToast()`
 * лишь варнит в консоль и возвращает undefined — тосты молча
 * мертвы. Поэтому захват только здесь (экспорт зовётся из setup).
 */
function acquireToast(): void {
  if (toast) return
  try { toast = useToast() } catch { toast = null }
}

function init() {
  if (inited) return
  inited = true
  if (!readCanModerate()) return
  void refresh()
  subscribe()
}

/**
 * Сбросить очередь при смене аккаунта.
 */
export function resetAdminReviews(): void {
  try {
    leaveUserChannel()
  } catch {}
  inited = false
  reviews.value = []
  pendingCount.value = 0
  error.value = null
}

export function useAdminReviews() {
  acquireToast()
  const hasData = computed(() => reviews.value.length > 0)
  return { reviews, pendingCount, loading, filter, actingId, error, hasData, refresh, resolve, setFilter, init, subscribe }
}
