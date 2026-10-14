import { appDb } from '@/db/app.db'

/**
 * Offline-кеш чата в IndexedDB (stale-while-revalidate).
 *
 * Паттерн: мгновенно рисуем кеш → фоном тянем сервер → точечно
 * патчим кеш. Инвалидация идёт через realtime-bus (`user:message.sent`,
 * `chat:previews`, `chat:open-ids` и т.д.), поэтому одинаково работает
 * и на сокетах (Echo), и на polling-транспорте — поллер зеркалит те же
 * события в шину (см. useRealtimePoller).
 *
 * Кеш строго per-аккаунт (`uid` в каждом ключе): смена юзера без
 * перезагрузки не показывает чужие диалоги. Ошибка IndexedDB
 * (приватный режим, квота) никогда не роняет чат — возвращаем null.
 *
 * @example
 * const cached = await loadCachedConversations(uid)
 * if (cached) conversations.value = cached
 * const fresh = await chatApi.conversations()
 * await saveConversations(uid, fresh)
 */
function conversationKey(uid: number, convId: number): string {
  return `${uid}:${convId}`
}

function messageKey(uid: number, id: number): string {
  return `${uid}:${id}`
}

function syncKey(uid: number, scope: string): string {
  return `${uid}:${scope}`
}

/**
 * Прочитать кешированные диалоги.
 *
 * Сортировка — по времени последнего сообщения (свежие сверху),
 * закрепы всплывут уже в useChat.sortConversations. Без сортировки
 * IndexedDB отдаёт в порядке ключей — сайдбар прыгал после перезагрузки.
 *
 * @param uid id текущего пользователя
 * @returns список диалогов или null при пустом кеше
 */
export async function loadCachedConversations(uid: number): Promise<any[] | null> {
  if (!(uid > 0)) {
    return null
  }
  try {
    const rows = await appDb.chatConversations.where('uid').equals(uid).toArray()
    if (rows.length === 0) {
      return null
    }
    const list: any[] = []
    for (const row of rows) {
      try {
        list.push(JSON.parse(row.value))
      } catch {}
    }
    list.sort((a, b) => {
      const pinnedDiff = Number(b?.is_pinned ?? false) - Number(a?.is_pinned ?? false)
      if (pinnedDiff !== 0) {
        return pinnedDiff
      }
      const timeA = new Date(a?.last_message_at || a?.updated_at || 0).getTime() || 0
      const timeB = new Date(b?.last_message_at || b?.updated_at || 0).getTime() || 0
      return timeB - timeA
    })
    return list
  } catch {
    return null
  }
}

/**
 * Прочитать один кешированный диалог (мгновенная шапка без сети).
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @returns диалог или null при промахе
 */
export async function loadCachedConversation(uid: number, convId: number): Promise<any | null> {
  if (!(uid > 0) || !(convId > 0)) {
    return null
  }
  try {
    const row = await appDb.chatConversations.get(conversationKey(uid, convId))
    if (!row) {
      return null
    }
    try {
      return JSON.parse(row.value)
    } catch {
      return null
    }
  } catch {
    return null
  }
}

/**
 * Сохранить диалоги (upsert, без удаления старых страниц пагинации).
 *
 * @param uid id текущего пользователя
 * @param list диалоги с сервера
 */
export async function saveConversations(uid: number, list: unknown): Promise<void> {
  if (!(uid > 0) || !Array.isArray(list)) {
    return
  }
  const now = Date.now()
  const rows = []
  for (const conv of list as any[]) {
    const id = Number(conv?.id)
    if (!(id > 0)) {
      continue
    }
    rows.push({
      key: conversationKey(uid, id),
      uid,
      convId: id,
      updatedAt: now,
      value: JSON.stringify(conv),
    })
  }
  if (rows.length === 0) {
    return
  }
  try {
    await appDb.chatConversations.bulkPut(rows)
  } catch {}
}

/**
 * Точечно пропатчить строку диалога (превью, unread_count, пин).
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @param patch частичный патч полей
 */
export async function patchCachedConversation(uid: number, convId: number, patch: Record<string, unknown>): Promise<void> {
  if (!(uid > 0) || !(convId > 0)) {
    return
  }
  try {
    const row = await appDb.chatConversations.get(conversationKey(uid, convId))
    if (!row) {
      return
    }
    let current: any = null
    try {
      current = JSON.parse(row.value)
    } catch {
      return
    }
    const merged = { ...current, ...patch }
    await appDb.chatConversations.put({
      key: row.key,
      uid,
      convId,
      updatedAt: Date.now(),
      value: JSON.stringify(merged),
    })
  } catch {}
}

/**
 * Удалить диалог из кеша вместе с его сообщениями.
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 */
export async function removeCachedConversation(uid: number, convId: number): Promise<void> {
  if (!(uid > 0) || !(convId > 0)) {
    return
  }
  try {
    await appDb.chatConversations.delete(conversationKey(uid, convId))
  } catch {}
  try {
    await appDb.chatMessages.where('convId').equals(convId).filter((row) => row.uid === uid).delete()
  } catch {}
  try {
    await appDb.syncMeta.delete(syncKey(uid, `messages:${convId}`))
  } catch {}
}

/**
 * Очистить весь список диалогов (кнопка «удалить все чаты»).
 *
 * @param uid id текущего пользователя
 */
export async function clearCachedConversations(uid: number): Promise<void> {
  if (!(uid > 0)) {
    return
  }
  try {
    await appDb.chatConversations.where('uid').equals(uid).delete()
  } catch {}
  try {
    await appDb.chatMessages.where('uid').equals(uid).delete()
  } catch {}
}

/**
 * Прочитать кешированный хвост диалога (последние N).
 *
 * Лимит по умолчанию 100: открытие после длинной прокрутки показывает
 * сразу весь последний экран + запас вверх, а не жалкие 60, после
 * которых раньше срабатывал полный рефетч с лоадером.
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @param limit сколько последних вернуть
 * @returns сообщения от старых к новым или null
 */
export async function loadCachedMessages(uid: number, convId: number, limit = 100): Promise<any[] | null> {
  if (!(uid > 0) || !(convId > 0)) {
    return null
  }
  try {
    const rows = await appDb.chatMessages.where('convId').equals(convId).filter((row) => row.uid === uid).sortBy('id')
    if (rows.length === 0) {
      return null
    }
    const tail = rows.slice(-Math.max(1, limit))
    const list: any[] = []
    for (const row of tail) {
      try {
        list.push(JSON.parse(row.value))
      } catch {}
    }
    return list
  } catch {
    return null
  }
}

/**
 * Прочитать страницу истории старше beforeId строго из кеша (без сети).
 *
 * Используется догрузкой вверх: пока в IndexedDB есть старые сообщения —
 * HTTP не ходим вообще. Возвращает oldest-first + флаг, есть ли ещё старше.
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @param beforeId грузить старше этого id
 * @param limit размер страницы
 * @returns {rows, hasMore} или null при промахе кеша
 */
export async function loadCachedMessagesBefore(
  uid: number,
  convId: number,
  beforeId: number,
  limit = 15,
): Promise<{ rows: any[]; hasMore: boolean } | null> {
  const before = Number(beforeId)
  const pageSize = Math.max(1, Number(limit) || 15)
  if (!(uid > 0) || !(convId > 0) || !(before > 0)) {
    return null
  }
  try {
    const older = await appDb.chatMessages
      .where('convId')
      .equals(convId)
      .filter((row) => row.uid === uid && row.id < before)
      .sortBy('id')
    if (older.length === 0) {
      return null
    }
    const page = older.slice(-pageSize)
    const list: any[] = []
    for (const row of page) {
      try {
        list.push(JSON.parse(row.value))
      } catch {}
    }
    if (list.length === 0) {
      return null
    }
    const hasMore = older.length > page.length
    return { rows: list, hasMore }
  } catch {
    return null
  }
}

/**
 * Максимальный закешированный id диалога (курсор дельта-синка).
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @returns max id или 0 когда кеш пуст
 */
export async function maxCachedMessageId(uid: number, convId: number): Promise<number> {
  if (!(uid > 0) || !(convId > 0)) {
    return 0
  }
  try {
    const rows = await appDb.chatMessages
      .where('convId')
      .equals(convId)
      .filter((row) => row.uid === uid)
      .toArray()
    let max = 0
    for (const row of rows) {
      if (row.id > max) {
        max = row.id
      }
    }
    return max
  } catch {
    return 0
  }
}

/**
 * Сохранить хвост диалога (открытие, ресинк). Держим ≤400 на диалог.
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @param list сообщения с сервера (старые первые)
 */
export async function saveMessages(uid: number, convId: number, list: unknown): Promise<void> {
  if (!(uid > 0) || !(convId > 0) || !Array.isArray(list)) {
    return
  }
  const rows = []
  for (const msg of list as any[]) {
    const id = Number(msg?.id)
    if (!(id > 0)) {
      continue
    }
    const createdAt = new Date(msg?.created_at ?? 0).getTime() || 0
    rows.push({
      key: messageKey(uid, id),
      uid,
      convId,
      id,
      createdAt,
      value: JSON.stringify(msg),
    })
  }
  if (rows.length === 0) {
    return
  }
  try {
    await appDb.chatMessages.bulkPut(rows)
  } catch {}
  await pruneMessages(uid, convId, 400)
}

/**
 * Точечный upsert одного сообщения (сокет/поллинг/оптимистика).
 *
 * @param uid id текущего пользователя
 * @param msg сообщение (toArrayPayload)
 */
export async function upsertCachedMessage(uid: number, msg: any): Promise<void> {
  const id = Number(msg?.id)
  const convId = Number(msg?.conversation_id)
  if (!(uid > 0) || !(id > 0) || !(convId > 0)) {
    return
  }
  const createdAt = new Date(msg?.created_at ?? 0).getTime() || 0
  try {
    await appDb.chatMessages.put({
      key: messageKey(uid, id),
      uid,
      convId,
      id,
      createdAt,
      value: JSON.stringify(msg),
    })
  } catch {}
}

/**
 * Удалить сообщение из кеша (`.message.deleted` с обоих транспортов).
 *
 * @param uid id текущего пользователя
 * @param messageId id сообщения
 */
export async function deleteCachedMessage(uid: number, messageId: number): Promise<void> {
  const id = Number(messageId)
  if (!(uid > 0) || !(id > 0)) {
    return
  }
  try {
    await appDb.chatMessages.delete(messageKey(uid, id))
  } catch {}
}

/**
 * Вычистить жёстко удалённые из кеша по срезу id с сервера.
 *
 * Зеркалит applyOpenIds из useChat: локальные моложе минимума среза,
 * но отсутствующие в нём, — удалены на сервере.
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @param serverIds хвост id с сервера
 */
export async function pruneDeletedByServerIds(uid: number, convId: number, serverIds: unknown): Promise<void> {
  if (!(uid > 0) || !(convId > 0) || !Array.isArray(serverIds) || serverIds.length === 0) {
    return
  }
  const server = new Set(
    (serverIds as unknown[]).map((id) => Number(id)).filter((id) => id > 0),
  )
  let minServer = Number.POSITIVE_INFINITY
  server.forEach((id) => {
    if (id < minServer) {
      minServer = id
    }
  })
  try {
    const rows = await appDb.chatMessages.where('convId').equals(convId).filter((row) => row.uid === uid).toArray()
    const gone: string[] = []
    for (const row of rows) {
      if (row.id < minServer || server.has(row.id)) {
        continue
      }
      gone.push(row.key)
    }
    if (gone.length > 0) {
      await appDb.chatMessages.bulkDelete(gone)
    }
  } catch {}
}

/**
 * Обнулить unread_count диалога в кеше (локальное прочтение).
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 */
export async function markCachedConversationRead(uid: number, convId: number): Promise<void> {
  await patchCachedConversation(uid, convId, { unread_count: 0 })
}

/**
 * Оставить только последние N сообщений диалога.
 *
 * @param uid id текущего пользователя
 * @param convId id диалога
 * @param keep сколько хранить
 */
async function pruneMessages(uid: number, convId: number, keep: number): Promise<void> {
  try {
    const count = await appDb.chatMessages.where('convId').equals(convId).filter((row) => row.uid === uid).count()
    const overflow = count - keep
    if (overflow <= 0) {
      return
    }
    const oldest = await appDb.chatMessages
      .where('convId')
      .equals(convId)
      .filter((row) => row.uid === uid)
      .sortBy('id')
    const victimKeys = oldest.slice(0, overflow).map((row) => row.key)
    await appDb.chatMessages.bulkDelete(victimKeys)
  } catch {}
}

/**
 * Точечно пропатчить сообщение в кеше (статусы доставки/прочтения).
 *
 * @param uid id текущего пользователя
 * @param id id сообщения
 * @param patch частичный патч полей
 */
export async function patchCachedMessage(uid: number, id: number, patch: Record<string, unknown>): Promise<void> {
  const mid = Number(id)
  if (!(uid > 0) || !(mid > 0)) {
    return
  }
  try {
    const row = await appDb.chatMessages.get(messageKey(uid, mid))
    if (!row) {
      return
    }
    let current: any = null
    try {
      current = JSON.parse(row.value)
    } catch {
      return
    }
    const merged = { ...current, ...patch }
    await appDb.chatMessages.put({
      key: row.key,
      uid,
      convId: row.convId,
      id: mid,
      createdAt: row.createdAt,
      value: JSON.stringify(merged),
    })
  } catch {}
}

/**
 * Прочитать курсор дельта-синка скоупа.
 *
 * @param uid id текущего пользователя
 * @param scope conversations | messages:{convId}
 * @returns server_time прошлого синка (ms) или 0
 */
export async function getSyncCursor(uid: number, scope: string): Promise<number> {
  if (!(uid > 0)) {
    return 0
  }
  try {
    const row = await appDb.syncMeta.get(syncKey(uid, scope))
    return row?.cursor ?? 0
  } catch {
    return 0
  }
}

/**
 * Сохранить курсор дельта-синка скоупа.
 *
 * @param uid id текущего пользователя
 * @param scope conversations | messages:{convId}
 * @param cursor server_time ответа (ms)
 */
export async function setSyncCursor(uid: number, scope: string, cursor: number): Promise<void> {
  if (!(uid > 0) || !(cursor > 0)) {
    return
  }
  try {
    await appDb.syncMeta.put({ key: syncKey(uid, scope), uid, cursor })
  } catch {}
}

/**
 * Полностью снести чат-кеш аккаунта (логаут/смена юзера).
 *
 * @param uid id пользователя
 */
export async function clearChatCache(uid: number): Promise<void> {
  if (!(uid > 0)) {
    return
  }
  try {
    await appDb.chatConversations.where('uid').equals(uid).delete()
  } catch {}
  try {
    await appDb.chatMessages.where('uid').equals(uid).delete()
  } catch {}
  try {
    await appDb.syncMeta.where('uid').equals(uid).delete()
  } catch {}
}
