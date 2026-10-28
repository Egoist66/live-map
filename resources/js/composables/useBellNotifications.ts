import { ref, computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { busOn } from '@/services/realtime-bus'
import { useBadgeStore } from '@/stores/badges'
import { currentAuthUid } from '@/composables/useAuthUid'

const isOpen = ref(false)
const conversations = ref<any[]>([])
const pending = ref<any[]>([])
const unreadChats = ref(0)
const loading = ref(false)
const tab = ref('events')
let dialogReadBound = false
let liveChatsBound = false
/** Дедап двойной доставки сообщения: сокет (user.*) и поллер (bus) несут одно и то же. */
const seenIncomingIds = new Map<number, number>()

/**
 * Свежая ли доставка сообщения (в пределах дедап-окна).
 *
 * @param id id сообщения
 * @returns true если это дубль в окне 5с
 */
function isDuplicateIncoming(id: number): boolean {
  const now = Date.now()
  const prev = seenIncomingIds.get(id)
  if (prev !== undefined && now - prev < 5000) return true
  seenIncomingIds.set(id, now)
  if (seenIncomingIds.size > 300) {
    const first = seenIncomingIds.keys().next().value as number | undefined
    if (first !== undefined) seenIncomingIds.delete(first)
  }
  return false
}

/**
 * Базовый ключ localStorage со скрытыми из панели диалогами.
 *
 * Мусорка панели не удаляет чаты — только прячет их строки:
 * запоминаем `{convId: last_message_at}` на момент очистки.
 * Диалог с более свежим сообщением показывается снова.
 *
 * Ключ персональный (`:<uid>`): без этого скрытия вкладки A
 * прятали бы диалоги вкладки B после смены аккаунта на том же устройстве.
 */
const DISMISSED_KEY = 'bell:dismissed-convs:v1'

/** Потолок записей скрытия: дальше старые сбрасываем (диалоги просто вернутся в панель). */
const DISMISSED_LIMIT = 500

/**
 * Ключ хранилища для текущего пользователя.
 *
 * @returns ключ localStorage с учётом uid
 */
function dismissedKey(): string {
  const uid = currentAuthUid()
  return uid > 0 ? `${DISMISSED_KEY}:${uid}` : DISMISSED_KEY
}

/**
 * Прочитать карту скрытий из localStorage.
 *
 * @returns `{convId: метка}` или пусто, если хранилища нет
 */
function readDismissed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(dismissedKey())
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
    localStorage.setItem(dismissedKey(), JSON.stringify(dismissed))
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
    const [convs, fr] = await Promise.all([
      chatApi.conversations(1, 50, { onlyUnread: true }).catch(() => [] as any[]),
      chatApi.friendships().catch(() => ({ pending_in: [] } as any)),
    ])
    const dismissed = readDismissed()
    const unreadRows = (convs as any[]).filter(
      (c: any) => Number(c?.unread_count || 0) > 0 && !isDismissed(c, dismissed),
    )
    unreadChats.value = unreadRows.length
    conversations.value = unreadRows
    pending.value = (fr.pending_in || []).slice(0, 8)
  } finally { loading.value = false }
}
function open() { isOpen.value = true; fetchAll() }
function close() { isOpen.value = false }
function goChat(id: number) { close(); router.visit(id ? `/chat/${id}` : '/chat') }
function goRequests() { close(); router.visit('/chat?tab=requests') }
function goFriends() { close(); router.visit('/chat?tab=friends') }

/**
 * Пересчитать счётчик непрочитанных чатов по активным строкам.
 */
function recountUnreadChats(): void {
  unreadChats.value = conversations.value.filter((c: any) => Number(c?.unread_count || 0) > 0).length
}

/**
 * Входящее сообщение при открытой модалке: строка диалога живо
 * появляется/обновляется в разделе «Сообщения», как в инсте.
 *
 * Сокет и поллер несут один и тот же user:message.sent — дедап
 * по id сообщения не даёт нарастить счётчик дважды. Прочтение здесь
 * НИКАК не вызываем: новая строка обязана дождаться пользователя.
 *
 * @param e событие user:message.sent {message}
 */
function onIncomingMessage(e: any): void {
  const msg = e?.message
  if (!msg?.id || !isOpen.value) return
  if (isDuplicateIncoming(Number(msg.id))) return
  const uid = currentAuthUid()
  if (uid > 0 && Number(msg.sender_id) === uid) return
  const convId = Number(msg.conversation_id)
  if (!(convId > 0)) return
  const dismissed = readDismissed()
  const row = conversations.value.find((c: any) => Number(c?.id) === convId)
  if (row) {
    row.last_message = msg
    row.last_message_at = msg.created_at
    // Скрытие проверяем по уже обновлённому last_message_at: новое
    // сообщение позже метки мусорки — строка снова видима, счётчик растёт.
    const hiddenByTrash = isDismissed(row, dismissed)
    if (!hiddenByTrash) {
      row.unread_count = Number(row.unread_count || 0) + 1
    }
    conversations.value = [row, ...conversations.value.filter((c) => c !== row)]
  } else {
    // Диалог не в топ-50 непрочитанных: собираем строку из самого
    // сообщения — имени и аватара отправителя достаточно для превью,
    // полный сериализованный ряд догрузит fetchAll при следующем открытии.
    conversations.value = [{
      id: convId,
      type: 'direct',
      other: msg.sender ?? null,
      last_message: msg,
      last_message_at: msg.created_at,
      unread_count: 1,
    }, ...conversations.value].slice(0, 50)
  }
  recountUnreadChats()
}

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
  ensureLiveChats()
  const hasData = computed(() => conversations.value.length > 0 || pending.value.length > 0)
  const unreadCount = computed(() => unreadChats.value)
  const isAdmin = computed(() => readIsAdmin())
  return { isOpen, conversations, pending, loading, tab, isAdmin, hasData, unreadCount, unreadChats, fetchAll, open, close, goChat, goRequests, goFriends, clearMessages }
}

/**
 * Разово подписаться на входящие сообщения для открытой модалки.
 *
 * Оба транспорта realtime дают user:message.sent (сокет user.{id} и
 * зеркалящий тик поллера), поэтому панель «Сообщения» оживает и в
 * WS-режиме, и в polling — без ветвлений и дублей (дедап по id выше).
 */
function ensureLiveChats(): void {
  if (liveChatsBound) return
  liveChatsBound = true
  try {
    busOn('user:message.sent', onIncomingMessage)
    busOn('user:message.read', onOwnReadRemotely)
    busOn('user:notification.inbox-changed', onInboxChanged)
    busOn('chat:unread-changed', onChatsUnreadChanged)
  } catch {
    liveChatsBound = false
  }
}

/**
 * Inbox погасили целиком на другом устройстве (вторая вкладка, телефон
 * или админская команда): на каждую строку `user:message.read` в этом
 * случае не приходит, поэтому перечитываем срез непрочитанных.
 *
 * @param e событие user:notification.inbox-changed
 */
function onInboxChanged(e: { all?: boolean } | null): void {
  if (!e?.all || !isOpen.value) return
  void fetchAll()
}

/**
 * Серверный счётчик непрочитанных чатов упал (поллер увидел прочтение
 * на другом устройстве): держим открытую панель в согласии с бэкендом.
 */
function onChatsUnreadChanged(): void {
  if (!isOpen.value) return
  void fetchAll()
}

/**
 * Диалог прочитан этим же аккаунтом на другом устройстве.
 *
 * Сокет приходит на user-каналы всех участников, поэтому реагируем
 * только когда `user_id` — наш: чужое прочтение наших сообщений
 * не должно убирать нашу непрочитанную строку.
 *
 * @param e событие user:message.read с conversation_id и user_id
 */
function onOwnReadRemotely(e: { conversation_id?: number; user_id?: number } | null): void {
  const uid = currentAuthUid()
  if (uid <= 0 || Number(e?.user_id) !== uid) return
  const id = Number(e?.conversation_id ?? 0)
  if (!(id > 0)) return
  const before = conversations.value.length
  conversations.value = conversations.value.filter((c: any) => Number(c?.id) !== id)
  if (conversations.value.length !== before) unreadChats.value = Math.max(0, unreadChats.value - 1)
}

/**
 * Разово подписаться на локальное прочтение диалогов.
 *
 * Колокольчик показывает только непрочитанные: прочитанный диалог
 * сразу исчезает из раздела «Сообщения», как лента в инсте.
 */
function ensureDialogReadSync(): void {
  if (dialogReadBound) return
  dialogReadBound = true
  try {
    busOn('chat:dialog-read', (convId: number) => {
      const id = Number(convId)
      if (!(id > 0)) return
      const before = conversations.value.length
      conversations.value = conversations.value.filter((c: any) => Number(c?.id) !== id)
      if (conversations.value.length !== before) unreadChats.value = Math.max(0, unreadChats.value - 1)
    })
  } catch {
    dialogReadBound = false
  }
}

/**
 * Сбросить срез колокольчика при смене аккаунта/выходе.
 *
 * Список и счётчик — модульные: без сброса новый аккаунт видел бы
 * «фантомную» «1» от прошлого пользователя до первого открытия панели.
 */
export function resetBellNotifications(): void {
  isOpen.value = false
  conversations.value = []
  pending.value = []
  unreadChats.value = 0
  loading.value = false
  tab.value = 'events'
}
