import { computed, reactive, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { chatApi, CHAT_HISTORY_PAGE_SIZE } from '@/services/chat.api'
import { busOn, busEmit } from '@/services/realtime-bus'
import { ensureUserChannel } from '@/composables/useUserChannel'
import {
  ensureChatCacheSync,
  loadCachedMessages,
  markCachedConversationRead,
  patchCachedConversation,
  saveConversations,
  saveMessages,
  upsertCachedMessage,
} from '@/composables/useChatCache'
import { pokeRealtime } from '@/composables/useRealtimePoller'
import { captureAuthUid, currentAuthUid } from '@/composables/useAuthUid'
import { useBadgeStore } from '@/stores/badges'
import { useRewardToast } from '@/composables/useRewardToast'
import { avatarSrcFor } from '@/composables/useAvatar'
import type { Conversation, Message } from '@/types/entities/Chat'

/**
 * Мини-окно диалога VK-стиля: история, черновик, флаги загрузки.
 */
export type MiniWindow = {
  convId: number
  title: string
  avatar: string | null
  messages: Message[]
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  sending: boolean
  draft: string
  error: string | null
}

/** Максимум открытых окон: 3×300 + FAB влезают в 1024px. */
const MAX_WINDOWS = 3

const listOpen = ref(false)
const windows = ref<MiniWindow[]>([])
const conversations = ref<Conversation[]>([])
const listLoading = ref(false)
const query = ref('')
const recentIds = new Map<number, number>()
let busBound = false

/**
 * Короткий дедуп двойной доставки: сокет (user:message.sent)
 * и поллер (chat:message) несут одно и то же сообщение.
 * Без него превью наращивало unread_count дважды.
 *
 * @param id id сообщения
 * @returns true если это дубль в окне 5с
 */
function isDuplicateMessage(id: number): boolean {
  const now = Date.now()
  const prev = recentIds.get(id)
  if (prev !== undefined && now - prev < 5000) {
    return true
  }
  recentIds.set(id, now)
  if (recentIds.size > 500) {
    const first = recentIds.keys().next().value as number | undefined
    if (first !== undefined) {
      recentIds.delete(first)
    }
  }
  return false
}

/**
 * Сбросить мини-чат при смене аккаунта/выходе.
 */
export function resetMiniChat(): void {
  listOpen.value = false
  windows.value = []
  conversations.value = []
  listLoading.value = false
  query.value = ''
  recentIds.clear()
}

function getUid(): number {
  const cached = currentAuthUid()
  if (cached > 0) return cached
  try {
    const inertiaUid = Number((usePage().props.auth as any)?.user?.id || 0)
    if (inertiaUid) return inertiaUid
  } catch { /* вне Inertia-контекста — идём к запаскам */ }
  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
  } catch { /* meta недоступна */ }
  return Number((window as any).userId || 0)
}

function findWindow(convId: number): MiniWindow | undefined {
  return windows.value.find((w) => w.convId === convId)
}

/**
 * Видна ли вкладка пользователю прямо сейчас.
 *
 * @returns true когда вкладка скрыта (фон, свёрнуто) — прочитанным не помечаем
 */
function isTabHidden(): boolean {
  try {
    return typeof document !== 'undefined' && document.hidden
  } catch {
    return false
  }
}

function windowTitle(detail: { other?: { name?: string } | null; title?: string | null } | null): string {
  return detail?.other?.name || detail?.title || 'Чат'
}

/**
 * Обновить список диалогов с сервера (уровень модуля: доступен
 * и обработчикам шины, и методу refreshList внутри useMiniChat).
 */
async function reloadConversations(): Promise<void> {
  if (listLoading.value) return
  listLoading.value = true
  try {
    conversations.value = await chatApi.conversations().catch(() => [] as Conversation[])
  } finally {
    listLoading.value = false
  }
}

/**
 * Тихо пометить диалог прочитанным: локальный счётчик + сервер + бейджи.
 *
 * Сразу рассылает `chat:dialog-read`: страница /chat и колокольчик
 * держат свои списки диалогов и иначе показывали бы протухшую «1».
 * @param convId диалог
 */
async function markReadQuiet(convId: number): Promise<void> {
  const row = conversations.value.find((c) => c.id === convId)
  if (row) row.unread_count = 0
  const uid = getUid()
  if (uid > 0) {
    // Страница /chat может быть не смонтирована — её applyDialogRead тогда
    // не отработает, и IDB воскресит бейдж при следующем открытии.
    void markCachedConversationRead(uid, Number(convId))
  }
  try {
    busEmit('chat:dialog-read', Number(convId))
  } catch { /* свой список уже погашен выше */ }
  try {
    await chatApi.markRead(convId)
  } catch { /* прочтение не критично */ }
  try {
    await useBadgeStore().refresh()
  } catch { /* бейджи подтянет шина */ }
}

/**
 * Диалог прочитали в соседнем списке (страница /chat): погасить
 * свою строку, чтобы FAB дока не показывал протухшую «1».
 * Без ре-эмита — петля между списками исключена.
 * @param convId id диалога из события
 */
function onDialogRead(convId: number): void {
  const id = Number(convId)
  if (!(id > 0)) return
  const row = conversations.value.find((c) => c.id === id)
  if (row) row.unread_count = 0
}

/**
 * Вшить свежее сообщение в превью списка (вверх, без полного рефетча).
 * @param convId диалог
 * @param msg сообщение
 * @param unreadInc нарастить ли несчётчик
 */
function patchPreview(convId: number, msg: Message, unreadInc: boolean): void {
  const idx = conversations.value.findIndex((c) => c.id === convId)
  if (idx < 0) {
    void reloadConversations()
    return
  }
  const row = conversations.value[idx]
  row.last_message = msg
  row.last_message_at = msg.created_at
  if (unreadInc) row.unread_count = Number(row.unread_count || 0) + 1
  conversations.value = [row, ...conversations.value.filter((c) => c.id !== convId)]
}

/**
 * Входящее сообщение из шины (сокет Echo или поллер).
 * Свои сообщения из другой вкладки тоже вшиваем без прочтения.
 * Чужое помечаем прочитанным, только если окно открыто И вкладка
 * видима: иначе сообщение, прилетевшее в фон (свёрнутый Mini App,
 * другая вкладка), тихо гасло бы непрочитанным.
 */
function onMessage(e: unknown): void {
  const msg = (e as { message?: Message })?.message
  if (!msg?.id) return
  if (isDuplicateMessage(Number(msg.id))) return
  const convId = Number(msg.conversation_id)
  const own = Number(msg.sender_id) === getUid()
  const win = findWindow(convId)
  if (win) {
    if (!win.messages.some((m) => m.id === msg.id)) {
      win.messages = [...win.messages, msg]
    }
    if (!own && !isTabHidden()) void markReadQuiet(convId)
    else patchPreview(convId, msg, false)
    return
  }
  patchPreview(convId, msg, !own)
}

function subscribe(): void {
  try {
    ensureUserChannel()
    ensureChatCacheSync()
    if (busBound) return
    busBound = true
    busOn('user:message.sent', onMessage)
    busOn('chat:message', onPollMessage)
    busOn('user:message.updated', onUpdated)
    busOn('user:message.deleted', onDeleted)
    busOn('user:message.delivered', onDelivered)
    busOn('user:message.read', onRead)
    busOn('chat:receipts', onReceipts)
    busOn('chat:dialog-read', onDialogRead)
    busOn('user:match.created', onMatch)
    busOn('user:friendship.updated', () => void reloadConversations())
    busOn('user:conversation.removed', onConversationsRemoved)
    busOn('chat:previews', onPreviews)
    busOn('chat:open-ids', onOpenIds)
  } catch { /* шина недоступна — мини-чат работает вручную */ }
}

/**
 * Мэтч из realtime: мгновенно поднимает is_match у собеседника в доке,
 * чтобы стиль (пилюля «Мэтч», ULove-вид) обновился без перезагрузки.
 * Страница /chat может быть не смонтирована — патчим и её IDB-кеш.
 *
 * @param e событие user:match.created
 */
function onMatch(e: unknown): void {
  const payload = e as { conversation_id?: number; user_a?: { id?: number } | null; user_b?: { id?: number } | null; user?: { id?: number } | null } | null
  const convId = Number(payload?.conversation_id ?? 0)
  const userA = payload?.user_a ?? null
  const userB = payload?.user_b ?? null
  const me = getUid()
  const otherId = userA && userB
    ? (Number(userA.id) === me ? Number(userB.id) : Number(userA.id))
    : Number(payload?.user?.id ?? 0)
  const uid = getUid()
  for (const conv of conversations.value) {
    const peer = (conv as { other?: { id?: number; is_match?: boolean } | null }).other
    if (!peer) continue
    const hitsOther = otherId > 0 && Number(peer.id) === otherId
    const hitsConv = convId > 0 && Number(conv.id) === convId
    if (!hitsOther && !hitsConv) continue
    peer.is_match = true
    if (uid > 0 && Number(conv.id) > 0) {
      void patchCachedConversation(uid, Number(conv.id), { other: peer })
    }
  }
}

/**
 * Диалоги убраны у себя (другое устройство/вкладка, очистка всего):
 * выкидываем строки дока и закрываем их окна без запросов.
 *
 * @param e событие user:conversation.removed {ids}
 */
function onConversationsRemoved(e: unknown): void {
  const raw = (e as { ids?: unknown })?.ids
  if (!Array.isArray(raw) || raw.length === 0) return
  const gone = new Set(raw.map((id) => Number(id)).filter((id) => id > 0))
  if (gone.size === 0) return
  conversations.value = conversations.value.filter((c) => !gone.has(Number(c?.id)))
  windows.value = windows.value.filter((w) => !gone.has(Number(w?.convId)))
}

/**
 * Лёгкие превью из поллинга: свежее последнее + честный unread_count.
 * Открытое окно не воскрешаем бейджем — там уже прочитано.
 *
 * @param previews превью изменившихся диалогов
 */
function onPreviews(previews: unknown): void {
  if (!Array.isArray(previews) || previews.length === 0) return
  let unknown = false
  for (const preview of previews as Array<{ id?: number; last_message?: Message | null; last_message_at?: string; unread_count?: number }>) {
    const id = Number(preview?.id ?? 0)
    if (!(id > 0)) continue
    const row = conversations.value.find((c) => Number(c?.id) === id)
    if (!row) {
      unknown = true
      continue
    }
    if (preview?.last_message) {
      row.last_message = preview.last_message
      row.last_message_at = preview.last_message_at ?? preview.last_message.created_at
    }
    if (preview?.unread_count != null) {
      const winOpen = findWindow(id) !== undefined
      row.unread_count = winOpen && !isTabHidden() ? 0 : Number(preview.unread_count)
    }
  }
  conversations.value = [...conversations.value].sort((a, b) => {
    const timeA = new Date(a?.last_message_at || 0).getTime() || 0
    const timeB = new Date(b?.last_message_at || 0).getTime() || 0
    return timeB - timeA
  })
  if (unknown) void reloadConversations()
}

/**
 * Хвост id открытого диалога: вычищает жёстко удалённые из мини-окна.
 * Старые (старше среза) и optimistic не трогаем.
 *
 * @param e событие chat:open-ids {conversationId, ids}
 */
function onOpenIds(e: unknown): void {
  const payload = e as { conversationId?: number; ids?: unknown } | null
  const conversationId = Number(payload?.conversationId ?? 0)
  if (!(conversationId > 0) || !Array.isArray(payload?.ids) || (payload?.ids as unknown[]).length === 0) return
  const win = findWindow(conversationId)
  if (!win) return
  const serverIds = new Set((payload?.ids as unknown[]).map((id) => Number(id)).filter((id) => id > 0))
  let minServer = Number.POSITIVE_INFINITY
  serverIds.forEach((id) => {
    if (id < minServer) minServer = id
  })
  const before = win.messages.length
  win.messages = win.messages.filter((m) => {
    const id = Number(m?.id)
    if (!(id > 0) || id < minServer || serverIds.has(id)) return true
    return false
  })
  if (win.messages.length !== before) {
    win.messages = [...win.messages]
  }
}

/**
 * Совпало ли сообщение с квитанцией доставки/прочтения.
 * @param m сообщение из окна или превью
 * @param ids точные id из события (пусто — срез по диалогу)
 * @param convId диалог среза для пустого ids
 */
function matchesReceipt(m: unknown, ids: Set<number>, convId: number | null): boolean {
  const row = m as { id?: number; conversation_id?: number }
  if (ids.size > 0) {
    return ids.has(Number(row?.id))
  }
  if (convId === null) {
    return false
  }
  return Number(row?.conversation_id) === convId
}

/**
 * Вшивает квитанцию в одно сообщение.
 * @param m сообщение из окна или превью
 * @param kind доставка или прочтение
 * @param at метка времени
 * @returns true если что-то поменялось
 */
function stampReceipt(m: unknown, kind: 'delivered' | 'read', at: string): boolean {
  const row = m as { delivered_at?: string | null; read_at?: string | null; status?: string }
  if (!row || (row as { id?: number }).id == null) {
    return false
  }
  let touched = false
  if (!row.delivered_at) {
    row.delivered_at = at
    touched = true
  }
  if (kind === 'read' && !row.read_at) {
    row.read_at = at
    touched = true
  }
  const nextStatus = kind === 'read' ? 'read' : 'delivered'
  if (row.status !== 'read' && row.status !== nextStatus) {
    row.status = nextStatus
    touched = true
  }
  return touched
}

/**
 * Разносит квитанцию по мини-окнам и превью списка.
 * @param kind доставка или прочтение
 * @param ids точные id сообщений
 * @param at метка времени
 * @param convId диалог среза (когда ids пустые)
 */
function applyReceipt(kind: 'delivered' | 'read', ids: Set<number>, at: string, convId: number | null): void {
  for (const win of windows.value) {
    let touched = false
    for (const m of win.messages) {
      const matched = matchesReceipt(m, ids, convId)
      if (matched && stampReceipt(m, kind, at)) {
        touched = true
      }
    }
    if (touched) {
      win.messages = [...win.messages]
    }
  }
  for (const conv of conversations.value) {
    const last = (conv as { last_message?: unknown }).last_message
    if (matchesReceipt(last, ids, convId)) {
      stampReceipt(last, kind, at)
    }
  }
}

/**
 * Доставка своих сообщений (сокет и поллер несут одно событие).
 * @param e событие user:message.delivered
 */
function onDelivered(e: unknown): void {
  const payload = e as { message_ids?: number[]; delivered_at?: string; conversation_id?: number }
  const ids = new Set((payload?.message_ids ?? []).map(Number))
  const convId = payload?.conversation_id != null ? Number(payload.conversation_id) : null
  if (!ids.size && convId === null) {
    return
  }
  const at = payload?.delivered_at ?? new Date().toISOString()
  applyReceipt('delivered', ids, at, convId)
}

/**
 * Прочтение своих сообщений (сокет и поллер несут одно событие).
 * @param e событие user:message.read
 */
function onRead(e: unknown): void {
  const payload = e as { message_ids?: number[]; read_at?: string; conversation_id?: number }
  const ids = new Set((payload?.message_ids ?? []).map(Number))
  const convId = payload?.conversation_id != null ? Number(payload.conversation_id) : null
  if (!ids.size && convId === null) {
    return
  }
  const at = payload?.read_at ?? new Date().toISOString()
  applyReceipt('read', ids, at, convId)
}

/**
 * Пакет квитанций из polling-тика.
 * @param list квитанции {id, delivered_at, read_at}
 */
function onReceipts(list: unknown): void {
  if (!Array.isArray(list) || !list.length) {
    return
  }
  for (const receipt of list as Array<{ id?: number; delivered_at?: string; read_at?: string }>) {
    const id = Number(receipt?.id)
    if (!id) {
      continue
    }
    const ids = new Set([id])
    if (receipt?.read_at) {
      const at = receipt.read_at
      applyReceipt('read', ids, at, null)
    } else if (receipt?.delivered_at) {
      const at = receipt.delivered_at
      applyReceipt('delivered', ids, at, null)
    }
  }
}

/**
 * Входящее из polling-шины: она несёт само сообщение, а не обёртку.
 * @param msg сообщение из chat:message
 */
function onPollMessage(msg: unknown): void {
  const candidate = msg as Message | null
  if (!candidate?.id) return
  onMessage({ message: candidate })
}

/**
 * Правка сообщения: обновить окно и превью списка.
 * @param e событие user:message.updated
 */
function onUpdated(e: unknown): void {
  const msg = (e as { message?: Message })?.message
  if (!msg?.id) return
  const convId = Number(msg.conversation_id)
  const win = findWindow(convId)
  if (win) {
    const idx = win.messages.findIndex((m) => m.id === msg.id)
    if (idx !== -1) {
      const next = [...win.messages]
      next[idx] = msg
      win.messages = next
    }
  }
  const row = conversations.value.find((c) => c.id === convId)
  if (row && Number(row.last_message?.id) === Number(msg.id)) {
    row.last_message = msg
  }
}

/**
 * Удаление сообщения: вычистить из окна и освежить превью.
 * @param e событие user:message.deleted
 */
function onDeleted(e: unknown): void {
  const rawId = (e as { message_id?: number; id?: number })?.message_id
    ?? (e as { message_id?: number; id?: number })?.id
  const mid = Number(rawId)
  if (!mid) return
  for (const win of windows.value) {
    const has = win.messages.some((m) => m.id === mid)
    if (has) {
      win.messages = win.messages.filter((m) => m.id !== mid)
    }
  }
  const stale = conversations.value.find((c) => Number(c.last_message?.id) === mid)
  if (stale) {
    void reloadConversations()
  }
}

/**
 * VK-виджет чатов для десктопа: список + до 3 мини-окон.
 *
 * Список и окна живут в синглтоне — состояние переживает навигацию.
 * Полный функционал (файлы, голос, закрепы) — в /chat, тут быстрые тексты.
 *
 * @example
 * const mini = useMiniChat()
 * await mini.openWindow(convId)
 */
export function useMiniChat() {
  captureAuthUid()
  subscribe()
  const rewards = useRewardToast()

  const myId = computed(() => getUid())

  /**
   * Бейдж дока: число чатов с непрочитанным — как в колокольчике,
   * а не сумма сообщений (200 + 300 сообщений = 2, а не 500).
   */
  const unreadTotal = computed(() => {
    return conversations.value.filter((conv) => Number(conv?.unread_count || 0) > 0).length
  })

  /**
   * Сумма непрочитанных сообщений по всем чатам (для будущего использования).
   */
  const unreadMessagesTotal = computed(() => {
    return conversations.value.reduce((sum, conv) => {
      const unread = Number(conv?.unread_count || 0)
      return sum + unread
    }, 0)
  })

  const filtered = computed(() => {
    const term = query.value.trim().toLowerCase()
    if (!term) return conversations.value
    return conversations.value.filter((c) => {
      const name = (c.other?.name || c.title || 'Чат').toLowerCase()
      return name.includes(term)
    })
  })

  /**
   * Обновить список диалогов с сервера.
   */
  async function refreshList(): Promise<void> {
    await reloadConversations()
  }

  /**
   * Показать/скрыть панель списка (открытие тянет свежие диалоги).
   */
  async function toggleList(): Promise<void> {
    listOpen.value = !listOpen.value
    if (listOpen.value) await refreshList()
  }

  function closeList(): void {
    listOpen.value = false
  }

  /**
   * Открыть мини-окно диалога (история + прочтение).
   * @param convId диалог
   */
  async function openWindow(convId: number): Promise<void> {
    listOpen.value = false
    const existing = findWindow(convId)
    if (existing) {
      windows.value = [...windows.value.filter((w) => w.convId !== convId), existing]
      await markReadQuiet(convId)
      return
    }
    const win: MiniWindow = reactive({
      convId,
      title: 'Чат',
      avatar: null,
      messages: [],
      hasMore: false,
      loading: true,
      loadingMore: false,
      sending: false,
      draft: '',
      error: null,
    })
    windows.value = [...windows.value.slice(-(MAX_WINDOWS - 1)), win]
    // Кеш-first: мгновенный рендер хвоста из IDB (общий со страницей /chat),
    // сеть — тихой ревалидацией следом. Без кеша — как раньше, с лоадером.
    const cacheUid = getUid()
    let cacheHit = false
    if (cacheUid > 0) {
      try {
        const row = conversations.value.find((c) => Number(c?.id) === Number(convId))
        if (row) {
          win.title = (row.other?.name || row.title || 'Чат') as string
          win.avatar = avatarSrcFor(row.other)
        }
        const cached = await loadCachedMessages(cacheUid, convId, 100)
        if (cached && cached.length > 0 && findWindow(convId) === win) {
          win.messages = cached as Message[]
          win.hasMore = cached.length >= 100
          win.loading = false
          cacheHit = true
        }
      } catch { /* промах кеша — идём в сеть с лоадером */ }
    }
    try {
      const detail = await chatApi.getConversation(convId).catch(() => null)
      if (findWindow(convId) !== win) return
      if (!detail) {
        if (!cacheHit) {
          win.error = 'Не открылось — попробуй из раздела Чаты'
        }
        return
      }
      win.title = windowTitle(detail)
      win.avatar = avatarSrcFor(detail.other)
      const historyMessages = Array.isArray(detail.messages) ? detail.messages : []
      const serverIds = new Set(historyMessages.map((m) => Number(m?.id)))
      const localNewer = win.messages.filter((m) => Number(m?.id) > 0 && !serverIds.has(Number(m?.id)))
      win.messages = localNewer.length > 0
        ? [...historyMessages, ...localNewer].sort((a, b) => Number(a?.id) - Number(b?.id))
        : historyMessages
      const serverHasMore = (detail as { messages_has_more?: unknown }).messages_has_more
      if (typeof serverHasMore === 'boolean') {
        win.hasMore = serverHasMore
      } else {
        win.hasMore = historyMessages.length >= CHAT_HISTORY_PAGE_SIZE
      }
      if (cacheUid > 0 && win.messages.length > 0) {
        void saveMessages(cacheUid, convId, win.messages)
      }
      await markReadQuiet(convId)
    } finally {
      win.loading = false
    }
  }

  /**
   * Закрыть мини-окно.
   * @param convId диалог
   */
  function closeWindow(convId: number): void {
    windows.value = windows.value.filter((w) => w.convId !== convId)
  }

  /**
   * Догрузить историю вверх.
   * @param convId диалог
   */
  async function loadMore(convId: number): Promise<void> {
    const win = findWindow(convId)
    if (!win || win.loadingMore || !win.hasMore || !win.messages.length) return
    win.loadingMore = true
    try {
      const oldest = win.messages[0]?.id
      const res = await chatApi.messagesPage(convId, oldest)
      const known = new Set(win.messages.map((m) => m.id))
      win.messages = [...res.data.filter((m) => !known.has(m.id)), ...win.messages]
      win.hasMore = res.has_more
    } finally {
      win.loadingMore = false
    }
  }

  /**
   * Отправить текст из мини-окна.
   * @param convId диалог
   * @returns true при успехе
   */
  async function send(convId: number): Promise<boolean> {
    const win = findWindow(convId)
    if (!win) return false
    const text = win.draft.trim()
    if (!text || win.sending) return false
    win.sending = true
    win.error = null
    try {
      const msg = await chatApi.sendMessage(convId, text)
      rewards.applyReward(msg)
      win.messages = [...win.messages, msg]
      win.draft = ''
      patchPreview(convId, msg, false)
      const uid = getUid()
      if (uid > 0) {
        // Док делит IDB-кеш со страницей /chat: превью и сообщение должны
        // быть там сразу, а не ждать дельту (страница может не быть открыта).
        void upsertCachedMessage(uid, msg)
        const row = conversations.value.find((c) => Number(c?.id) === Number(convId))
        if (row) {
          void saveConversations(uid, [row])
        }
      }
      try {
        pokeRealtime()
      } catch { /* поллер подхватит следующим тиком */ }
      return true
    } catch {
      win.error = 'Не отправилось'
      return false
    } finally {
      win.sending = false
    }
  }

  /**
   * Открыть диалог в полной версии чата.
   * @param convId диалог
   */
  function goFull(convId: number): void {
    closeWindow(convId)
    router.visit(`/chat/${convId}`)
  }

  return { listOpen, windows, conversations, filtered, listLoading, query, myId, unreadTotal, unreadMessagesTotal, refreshList, toggleList, closeList, openWindow, closeWindow, loadMore, send, goFull }
}
