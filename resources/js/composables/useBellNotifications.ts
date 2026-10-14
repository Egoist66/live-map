import { ref, computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { busOn } from '@/services/realtime-bus'
import { useBadgeStore } from '@/stores/badges'

const isOpen = ref(false)
const conversations = ref<any[]>([])
const pending = ref<any[]>([])
const unreadChats = ref(0)
const loading = ref(false)
const tab = ref('events')
let dialogReadBound = false

/**
 * Ключ localStorage со скрытыми из панели диалогами.
 *
 * Мусорка панели не удаляет чаты — только прячет их строки:
 * запоминаем `{convId: last_message_at}` на момент очистки.
 * Диалог с более свежим сообщением показывается снова.
 */
const DISMISSED_KEY = 'bell:dismissed-convs:v1'

/** Потолок записей скрытия: дальше старые сбрасываем (диалоги просто вернутся в панель). */
const DISMISSED_LIMIT = 500

/**
 * Прочитать карту скрытий из localStorage.
 *
 * @returns `{convId: метка}` или пусто, если хранилища нет
 */
function readDismissed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * Сохранить карту скрытий в localStorage.
 *
 * @param dismissed карта `{convId: метка}`
 */
function writeDismissed(dismissed: Record<string, string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed))
  } catch {
    // Приватный режим: скроем только до следующего открытия панели.
  }
}

/**
 * Скрыт ли диалог очисткой панели.
 *
 * Скрыт, когда метка очистки не старше последнего сообщения:
 * всё, что пришло позже, — новое и показывается снова.
 * Без `last_message_at` сравнивать не с чем — считаем скрытым,
 * раз юзер его уже смахнул, а нового не прилетало.
 *
 * @param conv строка диалога из списка чатов
 * @param dismissed карта скрытий
 * @returns true если строку нельзя показывать в панели
 */
function isDismissed(conv: any, dismissed: Record<string, string>): boolean {
  const id = String(conv?.id ?? '')
  if (id === '') return false
  const stamp = dismissed[id]
  if (typeof stamp !== 'string' || stamp === '') return false
  const last = String(conv?.last_message_at ?? '')
  if (last === '') return true
  return stamp >= last
}

function readIsAdmin(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin'
  } catch { return false }
}

async function fetchAll() {
  loading.value = true
  try {
    const w = window as any
    const convsPromise = w.__conversationsInflight ? w.__conversationsInflight : chatApi.conversations().catch(() => [] as any[])
    const [convs, fr] = await Promise.all([
      convsPromise,
      chatApi.friendships().catch(() => ({ pending_in: [] } as any)),
    ])
    unreadChats.value = (convs as any[]).filter((c: any) => Number(c.unread_count || 0) > 0).length
    const dismissed = readDismissed()
    conversations.value = (convs as any[]).filter((c: any) => !isDismissed(c, dismissed)).slice(0, 8)
    pending.value = (fr.pending_in || []).slice(0, 8)
  } finally { loading.value = false }
}
function open() { isOpen.value = true; fetchAll() }
function close() { isOpen.value = false }
function goChat(id: number) { close(); router.visit(id ? `/chat/${id}` : '/chat') }
function goRequests() { close(); router.visit('/chat?tab=requests') }
function goFriends() { close(); router.visit('/chat?tab=friends') }

/**
 * Скрыть сообщения из панели колокольчика (кнопка-мусорка).
 *
 * Сами чаты и сообщения НЕ удаляются — строки пропадают только
 * из панели: непрочитанные диалоги помечаем прочитанными через API,
 * всем видимым запоминаем скрытие. Диалог с новым сообщением,
 * пришедшим после очистки, показывается снова. Заявки в друзья
 * не трогаем: им нужно действие (принять/отклонить), а не просмотр.
 *
 * @returns void
 */
async function clearMessages(): Promise<void> {
  const rows = conversations.value
  if (rows.length === 0) return

  let dismissed = readDismissed()
  if (Object.keys(dismissed).length > DISMISSED_LIMIT) dismissed = {}
  const fallbackStamp = new Date(Date.now() - 60000).toISOString()
  for (const row of rows) {
    const id = String((row as any)?.id ?? '')
    if (id === '') continue
    dismissed[id] = String((row as any)?.last_message_at ?? fallbackStamp)
  }
  writeDismissed(dismissed)

  const unreadIds = rows
    .filter((c: any) => Number(c?.unread_count ?? 0) > 0)
    .map((c: any) => Number(c?.id ?? 0))
    .filter((id: number) => id > 0)

  conversations.value = []
  unreadChats.value = 0
  try {
    const badge = useBadgeStore()
    badge.setUnread(0)
    badge.setUnreadMessages(0)
  } catch {
    // No-op: следующий тик поллера сам выровняет бейдж.
  }

  if (unreadIds.length > 0) {
    await Promise.allSettled(unreadIds.map((id: number) => chatApi.markRead(id)))
  }
}

export function useBellNotifications() {
  ensureDialogReadSync()
  const hasData = computed(() => conversations.value.length > 0 || pending.value.length > 0)
  const unreadCount = computed(() => unreadChats.value)
  const isAdmin = computed(() => readIsAdmin())
  return { isOpen, conversations, pending, loading, tab, isAdmin, hasData, unreadCount, unreadChats, fetchAll, open, close, goChat, goRequests, goFriends, clearMessages }
}

/**
 * Разово подписаться на локальное прочтение диалогов.
 *
 * Колокольчик держит свой срез диалогов (топ-8): диалог, прочитанный
 * на странице /chat или в мини-окне, иначе висел бы с протухшей «1»
 * до следующего открытия модалки.
 */
function ensureDialogReadSync(): void {
  if (dialogReadBound) return
  dialogReadBound = true
  try {
    busOn('chat:dialog-read', (convId: number) => {
      const id = Number(convId)
      if (!(id > 0)) return
      const row = conversations.value.find((c: any) => Number(c?.id) === id)
      if (row && Number(row?.unread_count || 0) > 0) {
        row.unread_count = 0
        unreadChats.value = conversations.value.filter((c: any) => Number(c.unread_count || 0) > 0).length
      }
    })
  } catch {
    dialogReadBound = false
  }
}
