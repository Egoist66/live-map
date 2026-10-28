import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { appUpdatesApi } from '@/services/app-updates.api'
import { useBadgeStore } from '@/stores/badges'
import { busOn } from '@/services/realtime-bus'

const queue = ref<any[]>([])
const history = ref<any[]>([])
const unreadCount = ref(0)
const loading = ref(false)
const inited = ref(false)
let busBound = false

/**
 * Сколько прятать одиночную новость по «Позже» (ротация [A] → [A] ничего не прячет).
 */
const SNOOZE_MS = 30 * 60 * 1000

const DISMISSED_KEY = 'app-updates:dismissed-v1'
const SNOOZED_KEY = 'app-updates:snoozed-v1'
const DISMISSED_CAP = 200

/**
 * Читать числовой id новости из localStorage.
 *
 * @param key ключ хранилища
 * @returns id новостей
 */
function readStoredIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  } catch {
    return []
  }
}

/**
 * Id новостей, закрытых кнопкой «Понятно» / «Прочитать все».
 *
 * Сервер может вернуть их снова (гонка запросов, ретрай, старая строка
 * снятой с публикации новости) — модалка их больше не покажет.
 * Дублируется в localStorage, чтобы перезагрузка не воскрешала.
 */
const dismissedIds = ref<Set<number>>(new Set(readStoredIds(DISMISSED_KEY)))

/**
 * Отложенные кнопкой «Позже»: id новости → timestamp, до которого прячем.
 */
const snoozedUntil = ref<Record<number, number>>(loadSnoozed())

/**
 * Id новостей с незавершённым markRead (защита от даблклика по «Понятно»).
 */
const inflightIds = ref<Set<number>>(new Set())

/**
 * Читать карту отложенных новостей, выкидывая просроченные.
 *
 * @returns id → timestamp
 */
function loadSnoozed(): Record<number, number> {
  const result: Record<number, number> = {}
  try {
    const raw = localStorage.getItem(SNOOZED_KEY)
    if (!raw) return result
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return result
    const now = Date.now()
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const id = Number(key)
      const until = Number(value)
      const fresh = Number.isFinite(id) && id > 0 && Number.isFinite(until) && until > now
      if (fresh) result[id] = until
    }
  } catch {
    // Битый кэш — начинаем с пустой карты.
  }
  return result
}

/**
 * Сохранить id закрытых новостей (с обрезкой до лимита).
 */
function persistDismissed(): void {
  try {
    const ids = [...dismissedIds.value].slice(-DISMISSED_CAP)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
  } catch {
    // Приватный режим — живём только памятью сессии.
  }
}

/**
 * Сохранить карту отложенных новостей.
 */
function persistSnoozed(): void {
  try {
    localStorage.setItem(SNOOZED_KEY, JSON.stringify(snoozedUntil.value))
  } catch {
    // Приватный режим — живём только памятью сессии.
  }
}

/**
 * Числовой id новости (0 — битый элемент, такие не показываем).
 *
 * @param item новость из очереди/истории
 * @returns id или 0
 */
function toId(item: any): number {
  const id = Number(item?.id ?? 0)
  return Number.isFinite(id) && id > 0 ? id : 0
}

/**
 * Закрыта ли новость кнопкой «Понятно» ранее.
 *
 * @param id id новости
 * @returns true — не показывать даже если сервер вернул снова
 */
function isDismissedLocal(id: number): boolean {
  return dismissedIds.value.has(id)
}

/**
 * Отложена ли новость кнопкой «Позже» прямо сейчас.
 *
 * Просрочка снимается лениво при первой проверке.
 *
 * @param id id новости
 * @returns true — прячем до истечения таймера
 */
function isSnoozed(id: number): boolean {
  const until = snoozedUntil.value[id]
  if (!until) return false
  const active = until > Date.now()
  if (!active) {
    delete snoozedUntil.value[id]
    persistSnoozed()
  }
  return active
}

/**
 * Можно ли показать новость в модалке.
 *
 * @param item новость из очереди
 * @returns true — показываем
 */
function isVisible(item: any): boolean {
  const id = toId(item)
  if (id <= 0) return false
  if (isDismissedLocal(id)) return false
  if (isSnoozed(id)) return false
  return true
}

/**
 * Запомнить закрытие новости навсегда (сессия + localStorage).
 *
 * @param id id новости
 */
function rememberDismissed(id: number): void {
  dismissedIds.value.add(id)
  persistDismissed()
}

/**
 * Отложить одиночную новость на SNOOZE_MS.
 *
 * @param id id новости
 */
function rememberSnoozed(id: number): void {
  snoozedUntil.value[id] = Date.now() + SNOOZE_MS
  persistSnoozed()
}

/**
 * Снять отложенность (явное открытие новости из колокольчика).
 *
 * @param id id новости
 */
function clearSnoozed(id: number): void {
  if (!(id in snoozedUntil.value)) return
  delete snoozedUntil.value[id]
  persistSnoozed()
}

/**
 * Выкинуть новость из очереди по id.
 *
 * @param id id новости
 */
function dropFromQueue(id: number): void {
  queue.value = queue.value.filter((entry) => toId(entry) !== id)
}

/**
 * Сколько свежих строк сервера уже спрятано локально.
 *
 * Нужно для честного бейджа: серверный count включает строки,
 * которые мы оптимистично спрятали, — вычитаем их.
 *
 * @param fresh свежие строки из unread()
 * @returns число спрятанных среди свежих
 */
function countHiddenIn(fresh: any[]): number {
  return fresh.filter((item) => !isVisible(item)).length
}

function readIsAdmin(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin'
  } catch { return false }
}

function syncBadge() {
  try { useBadgeStore().setUpdates(unreadCount.value) } catch {}
}

/**
 * Очередь модалки «Что нового».
 *
 * Анти-зацикливание: закрытая («Понятно») новость запоминается в dismissedIds
 * и никогда не возвращается в очередь из повторного unread()/realtime —
 * раньше markRead падал на сервере, фронт глотал ошибку, а ресинк тут же
 * клал ту же новость обратно и модалка открывалась бесконечно.
 *
 * @example
 * const updates = useAppUpdates()
 * updates.init()
 */
export function useAppUpdates() {
  const current = computed(() => queue.value.find((item) => isVisible(item)) ?? null)
  const hasUnread = computed(() => queue.value.some((item) => isVisible(item)))
  const sortedHistory = computed(() => [...history.value].sort((a, b) => Number(a.is_read ? 1 : 0) - Number(b.is_read ? 1 : 0)))

  async function loadUnread() {
    if (readIsAdmin()) { queue.value = []; unreadCount.value = 0; return }
    loading.value = true
    try {
      const d: any = await appUpdatesApi.unread()
      const fresh = Array.isArray(d?.updates) ? d.updates : []
      queue.value = fresh.filter((item: any) => isVisible(item))
      const serverCount = Number(d?.count ?? queue.value.length)
      unreadCount.value = Math.max(0, serverCount - countHiddenIn(fresh))
    } catch {
      queue.value = []
    } finally {
      loading.value = false
      syncBadge()
    }
  }

  async function loadHistory() {
    if (readIsAdmin()) { history.value = []; return }
    try {
      history.value = await appUpdatesApi.list()
    } catch {
      history.value = []
    }
  }

  /**
   * Тихий ресинк после закрытия: добирает genuinely новые новости,
   * но никогда не возвращает только что закрытые.
   */
  async function refreshUnreadQuietly(): Promise<void> {
    try {
      const d: any = await appUpdatesApi.unread()
      const fresh = Array.isArray(d?.updates) ? d.updates : []
      const knownIds = new Set(queue.value.map((entry) => toId(entry)))
      for (const item of fresh) {
        const freshId = toId(item)
        if (freshId <= 0) continue
        if (knownIds.has(freshId)) continue
        if (!isVisible(item)) continue
        knownIds.add(freshId)
        queue.value.push(item)
      }
      const serverCount = Number(d?.count ?? unreadCount.value)
      unreadCount.value = Math.max(0, serverCount - countHiddenIn(fresh))
      syncBadge()
    } catch {
      // Тихий ресинк ошибкам не мешает: очередь уже корректна локально.
    }
  }

  /**
   * Отметить новость в истории прочитанной (оптимистично).
   *
   * @param item новость из очереди
   * @param id id новости
   */
  function markHistoryRead(item: any, id: number): void {
    const found = history.value.find((entry) => toId(entry) === id)
    if (found) {
      found.is_read = true
      return
    }
    history.value = [{ ...item, is_read: true }, ...history.value]
  }

  async function dismissCurrent() {
    const item = current.value
    if (!item) return
    const id = toId(item)
    if (id <= 0) {
      dropFromQueue(0)
      return
    }
    if (inflightIds.value.has(id)) return
    // Прячем сразу, до сети: даже упавший markRead не вернёт модалку.
    dropFromQueue(id)
    rememberDismissed(id)
    clearSnoozed(id)
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    markHistoryRead(item, id)
    syncBadge()
    inflightIds.value.add(id)
    try {
      await appUpdatesApi.markRead(id)
    } catch {
      // Строка уже погашена локально и в dismissedIds — ресинк её не вернёт.
    } finally {
      inflightIds.value.delete(id)
    }
    await refreshUnreadQuietly()
  }

  async function dismissAll() {
    for (const entry of queue.value) {
      const entryId = toId(entry)
      if (entryId > 0) rememberDismissed(entryId)
    }
    try {
      await appUpdatesApi.markAllRead()
    } catch {}
    queue.value = []
    unreadCount.value = 0
    snoozedUntil.value = {}
    persistSnoozed()
    history.value = history.value.map((x) => ({ ...x, is_read: true }))
    syncBadge()
  }

  function snooze() {
    if (!queue.value.length) return
    const item = current.value
    if (!item) return
    const id = toId(item)
    // Одиночная новость: ротация [A] → [A] ничего не прячет,
    // модалка висит вечно — прячем на таймер вместо ротации.
    const isSingle = queue.value.length <= 1
    if (isSingle) {
      if (id > 0) rememberSnoozed(id)
      queue.value = []
      syncBadge()
      return
    }
    const [first, ...rest] = queue.value
    queue.value = [...rest, first]
  }

  function preview(item: any) {
    if (!item) return
    const id = toId(item)
    if (id <= 0) return
    if (isDismissedLocal(id)) return
    // Явное открытие из колокольчика сильнее «Позже».
    clearSnoozed(id)
    queue.value = [item, ...queue.value.filter((x) => toId(x) !== id)]
  }

  function init() {
    if (inited.value) return
    inited.value = true
    if (readIsAdmin()) return
    void loadUnread()
    void loadHistory()
    if (!busBound) {
      busBound = true
      try {
        busOn('user:notification.created', (e: any) => {
          const n = e?.notification
          if (!n?.id || n.type !== 'app.published' || !n.data?.update) return
          mergeIncoming([n.data.update])
        })
        busOn('user:notification.inbox-changed', () => {
          void loadUnread()
          void loadHistory()
        })
      } catch {}
    }
  }

  /**
   * Вливает новости из поллинга в очередь (модалка покажет сама).
   * Закрытые и отложенные не вливаются — иначе круг «закрыл-открылась».
   * @param updates новости из /api/realtime/sync
   */
  function mergeIncoming(updates: any[]): void {
    if (!Array.isArray(updates) || !updates.length) return
    if (readIsAdmin()) return
    const known = new Set(queue.value.map((x) => toId(x)))
    let added = false
    for (const u of updates) {
      if (u?.id == null) continue
      const incomingId = toId(u)
      if (incomingId <= 0) continue
      if (known.has(incomingId)) continue
      if (!isVisible(u)) continue
      known.add(incomingId)
      queue.value.push(u)
      added = true
    }
    if (added) syncBadge()
  }

  return { queue, history, sortedHistory, unreadCount, loading, current, hasUnread, loadUnread, loadHistory, dismissCurrent, dismissAll, snooze, preview, init }
}
