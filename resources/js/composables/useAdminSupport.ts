import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { supportApi, type SupportTicket } from '@/services/support.api'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'
import { avatarSrcFor } from '@/composables/useAvatar'

export type SupportFilter = 'new' | 'answered' | 'rejected' | 'all'

const tickets = ref<SupportTicket[]>([])
const newCount = ref(0)
const loading = ref(false)
const sending = ref(false)
const filter = ref<SupportFilter>('new')
const page = ref(1)
const lastPage = ref(1)
const selectedId = ref<number | null>(null)
const replyText = ref('')
const error = ref<string | null>(null)
let busBound = false
let inited = false
let toast: any = null

/**
 * Может ли текущий пользователь разбирать обращения.
 *
 * Модераторы отвечают наравне с админами (админ — тоже модератор).
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
 * Новый тикет live (сокет/поллер): в начало списка без дублей.
 *
 * @param e событие user:notification.created
 */
function onNotification(e: any) {
  const n = e?.notification
  if (!n?.id || n.type !== 'support.request') return
  newCount.value += 1
  if (filter.value !== 'new' && filter.value !== 'all') return
  const s = n?.data?.support ?? {}
  const ticketId = Number(s.ticket_id ?? 0)
  if (ticketId > 0 && tickets.value.some((t) => Number(t.id) === ticketId)) return
  void refresh()
}

/**
 * Человеческая подпись статуса тикета.
 *
 * @param status статус тикета
 */
export function supportStatusLabel(status: string): string {
  if (status === 'answered') return 'Отвечено'
  if (status === 'rejected') return 'Отклонено'
  return 'Новое'
}

/**
 * Severity PrimeVue-Tag под статус тикета.
 *
 * @param status статус тикета
 */
export function supportStatusSeverity(status: string): 'danger' | 'success' | 'secondary' {
  if (status === 'answered') return 'success'
  if (status === 'rejected') return 'secondary'
  return 'danger'
}

function subscribe() {
  try {
    const uid = getUid()
    if (!uid) return
    ensureUserChannel()
    if (busBound) return
    busBound = true
    busOn('user:notification.created', onNotification)
  } catch {}
}

async function refresh() {
  if (!readCanModerate()) return
  loading.value = true
  error.value = null
  try {
    const data: any = await supportApi.tickets(filter.value, page.value)
    const paginator = data?.tickets ?? {}
    tickets.value = Array.isArray(paginator.data) ? paginator.data : []
    page.value = Number(paginator.current_page ?? 1)
    lastPage.value = Number(paginator.last_page ?? 1)
    newCount.value = Number(data?.new_count ?? 0)
    if (selectedId.value !== null && !tickets.value.some((t) => Number(t.id) === Number(selectedId.value))) {
      selectedId.value = tickets.value.length > 0 ? Number(tickets.value[0].id) : null
    }
    if (selectedId.value === null && tickets.value.length > 0) {
      selectedId.value = Number(tickets.value[0].id)
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Не удалось загрузить обращения'
  } finally {
    loading.value = false
  }
}

function setFilter(next: SupportFilter) {
  filter.value = next
  page.value = 1
  selectedId.value = null
  void refresh()
}

function setPage(next: number) {
  const clamped = Math.min(Math.max(1, next), Math.max(1, lastPage.value))
  if (clamped === page.value) return
  page.value = clamped
  selectedId.value = null
  void refresh()
}

function select(id: number) {
  selectedId.value = id
  const ticket = tickets.value.find((t) => Number(t.id) === Number(id))
  replyText.value = ticket?.admin_reply || ''
}

/**
 * Ответить на выбранный тикет: письмо пользователю, статус answered.
 */
async function sendReply(): Promise<boolean> {
  const id = selectedId.value
  const message = replyText.value.trim()
  if (id === null || message.length < 2 || sending.value) return false
  sending.value = true
  try {
    const prev = tickets.value.find((t) => Number(t.id) === Number(id))
    const updated = await supportApi.replyTicket(id, message)
    tickets.value = tickets.value.map((t) => (Number(t.id) === Number(id) ? { ...t, ...updated } : t))
    if (prev?.status === 'new') {
      newCount.value = Math.max(0, newCount.value - 1)
    }
    if (filter.value === 'new') {
      tickets.value = tickets.value.filter((t) => Number(t.id) !== Number(id))
      selectedId.value = tickets.value.length > 0 ? Number(tickets.value[0].id) : null
      const next = selectedId.value !== null ? tickets.value.find((t) => Number(t.id) === Number(selectedId.value)) : null
      replyText.value = next?.admin_reply || ''
    }
    toast?.add({ severity: 'success', summary: 'Ответ отправлен', life: 2500 })
    return true
  } catch (e: any) {
    toast?.add({ severity: 'error', summary: e?.response?.data?.message || 'Не получилось отправить', life: 3500 })
    return false
  } finally {
    sending.value = false
  }
}

/**
 * Отклонить выбранный тикет. Непустой текст ответа уйдёт письмом
 * как причина, пустое отклонение писем не шлёт.
 */
async function rejectSelected(): Promise<boolean> {
  const id = selectedId.value
  if (id === null || sending.value) return false
  sending.value = true
  try {
    const reason = replyText.value.trim()
    const prev = tickets.value.find((t) => Number(t.id) === Number(id))
    const updated = await supportApi.rejectTicket(id, reason || undefined)
    tickets.value = tickets.value.map((t) => (Number(t.id) === Number(id) ? { ...t, ...updated } : t))
    if (prev?.status === 'new') {
      newCount.value = Math.max(0, newCount.value - 1)
    }
    if (filter.value === 'new') {
      tickets.value = tickets.value.filter((t) => Number(t.id) !== Number(id))
      selectedId.value = tickets.value.length > 0 ? Number(tickets.value[0].id) : null
      const next = selectedId.value !== null ? tickets.value.find((t) => Number(t.id) === Number(selectedId.value)) : null
      replyText.value = next?.admin_reply || ''
    }
    toast?.add({ severity: 'info', summary: 'Обращение отклонено', life: 2500 })
    return true
  } catch (e: any) {
    toast?.add({ severity: 'error', summary: e?.response?.data?.message || 'Не получилось отклонить', life: 3500 })
    return false
  } finally {
    sending.value = false
  }
}

/**
 * Забирает ToastService, пока мы в setup-контексте (см. useAdminReports).
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
  window.addEventListener('focus', subscribe)
}

/**
 * Сбросить обращения при смене аккаунта.
 */
export function resetAdminSupport(): void {
  try {
    leaveUserChannel()
  } catch {}
  inited = false
  tickets.value = []
  newCount.value = 0
  error.value = null
  selectedId.value = null
  replyText.value = ''
  page.value = 1
}

/**
 * Хук разбора обращений: список, фильтры, ответ и отклонение.
 *
 * Логика вся здесь (Правило №1): компонент `AdminSupportManager`
 * только рисует и зовёт экшены.
 *
 * @returns состояние тикетов и действия
 * @example
 * const support = useAdminSupport()
 * support.init()
 */
export function useAdminSupport() {
  acquireToast()
  const hasData = computed(() => tickets.value.length > 0)
  const selected = computed(() => tickets.value.find((t) => Number(t.id) === Number(selectedId.value)) ?? null)
  const hasMore = computed(() => page.value < lastPage.value)
  return {
    tickets,
    newCount,
    loading,
    sending,
    filter,
    page,
    lastPage,
    hasMore,
    selectedId,
    selected,
    replyText,
    error,
    hasData,
    avatarSrcFor,
    refresh,
    setFilter,
    setPage,
    select,
    sendReply,
    rejectSelected,
    init,
    subscribe,
  }
}
