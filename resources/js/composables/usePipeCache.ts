import { appDb } from '@/db/app.db'
import type { PipeThread } from '@/types/pipe'

/** Лимит тредов-строк на аккаунт: старые по updatedAt выметаются. */
const MAX_CACHED_THREADS = 200

/** Сколько страниц ленты живёт в снапшоте scope (10 тредов на страницу). */
const MAX_FEED_SNAPSHOT_THREADS = 60/**
 * Offline-кеш ленты Pipe в IndexedDB (stale-while-revalidate), как в чатах.
 *
 * Паттерн тот же, что у useChatCache: мгновенно рисуем кеш → фоном тянем
 * сервер → точечно патчим. Треды хранятся отдельными строками
 * (pipeThreads, key `${uid}:${threadId}`), лента — снапшотом scope
 * (pipeFeeds, key `${uid}:${filter}:${authorId}`) со списком id в порядке
 * показа. Инвалидация событийная: стор Pipe на каждый мутатор
 * (лайк/закладка/правка/удаление/realtime thread:updated) дергает
 * patch/remove здесь, поэтому протухшие треды в кеше не остаются.
 *
 * Поиск и диплинк-лента не кешируются: это транзиентные выдачи,
 * кеш-первым рендер для них не имеет смысла.
 *
 * Кеш строго per-аккаунт (`uid` в ключах), гость (uid=0) кеш не читает.
 * Ошибка IndexedDB (приватный режим, квота) никогда не роняет ленту.
 *
 * @example
 * const cached = await loadCachedFeed(uid, 'all:0')
 * if (cached) store.paintCache(cached)
 * const fresh = await pipeApi.feed({ filter: 'all' })
 * await saveFeed(uid, 'all:0', fresh.data, fresh.current_page, fresh.last_page)
 */
function threadKey(uid: number, threadId: number): string {
  return `${uid}:${threadId}`
}

/**
 * Ключ снапшота ленты.
 *
 * @param uid id текущего пользователя
 * @param scope скоуп ленты: `${filter}:${authorId ?? 0}`
 */
function feedKey(uid: number, scope: string): string {
  return `${uid}:${scope}`
}

/**
 * Прочитать кешированную ленту scope: снапшот id → строки тредов.
 *
 * @param uid id текущего пользователя (0 — гость, промах)
 * @param scope скоуп ленты
 * @returns страница ленты в порядке снапшота или null при промахе
 */
export async function loadCachedFeed(
  uid: number,
  scope: string,
): Promise<{ threads: PipeThread[]; page: number; lastPage: number } | null> {
  if (!(uid > 0)) return null

  try {
    const snapshotRow = await appDb.pipeFeeds.get(feedKey(uid, scope))
    if (!snapshotRow) return null

    let snapshot: { ids?: unknown; page?: unknown; last_page?: unknown }
    try {
      snapshot = JSON.parse(snapshotRow.value)
    } catch {
      return null
    }

    const ids = (Array.isArray(snapshot.ids) ? snapshot.ids : [])
      .map((id) => Number(id))
      .filter((id) => id > 0)
    if (ids.length === 0) return null

    const rows = await appDb.pipeThreads.bulkGet(ids.map((id) => threadKey(uid, id)))
    const byKey = new Map<string, PipeThread>()
    for (const row of rows) {
      if (!row) continue
      try {
        byKey.set(row.key, JSON.parse(row.value) as PipeThread)
      } catch { /* битая строка — пропускаем */ }
    }

    const threads: PipeThread[] = []
    for (const id of ids) {
      const thread = byKey.get(threadKey(uid, id))
      if (thread) threads.push(thread)
    }

    return {
      threads,
      page: Number(snapshot.page) || 1,
      lastPage: Number(snapshot.last_page) || 1,
    }
  } catch {
    return null
  }
}

/**
 * Прочитать один кешированный тред (мгновенная карточка без сети).
 *
 * @param uid id текущего пользователя (0 — гость, промах)
 * @param threadId тред
 * @returns тред или null при промахе
 */
export async function loadCachedThread(uid: number, threadId: number): Promise<PipeThread | null> {
  if (!(uid > 0) || !(threadId > 0)) return null

  try {
    const row = await appDb.pipeThreads.get(threadKey(uid, threadId))
    if (!row) return null
    try {
      return JSON.parse(row.value) as PipeThread
    } catch {
      return null
    }
  } catch {
    return null
  }
}

/**
 * Сохранить страницу ленты: upsert строк тредов + перезапись снапшота.
 * Старые страницы пагинации в строках не удаляются (утаскиваются
 * prune-ом по лимиту), но снапшот всегда описывает текущую выдачу.
 *
 * @param uid id текущего пользователя (0 — гость, no-op)
 * @param scope скоуп ленты
 * @param threads треды страницы с сервера
 * @param page текущая страница
 * @param lastPage всего страниц
 */
export async function saveFeed(
  uid: number,
  scope: string,
  threads: PipeThread[],
  page: number,
  lastPage: number,
): Promise<void> {
  if (!(uid > 0)) return

  const now = Date.now()
  const capped = threads.slice(0, MAX_FEED_SNAPSHOT_THREADS)
  const ids: number[] = []

  const threadRows = []
  for (const thread of capped) {
    if (!(Number(thread?.id) > 0)) continue
    ids.push(Number(thread.id))
    threadRows.push({
      key: threadKey(uid, thread.id),
      uid,
      id: Number(thread.id),
      updatedAt: now,
      value: JSON.stringify(thread),
    })
  }

  const snapshotRow = {
    key: feedKey(uid, scope),
    uid,
    scope,
    updatedAt: now,
    value: JSON.stringify({ ids, page, last_page: lastPage }),
  }

  try {
    await appDb.pipeThreads.bulkPut(threadRows)
    await appDb.pipeFeeds.put(snapshotRow)
  } catch { /* приватный режим/квота — лента работает без кеша */ }
}

/**
 * Точечный upsert одного треда (лайк, закладка, правка, refreshThread).
 *
 * @param uid id текущего пользователя (0 — гость, no-op)
 * @param thread актуальный тред
 */
export async function patchCachedThread(uid: number, thread: PipeThread): Promise<void> {
  if (!(uid > 0) || !(Number(thread?.id) > 0)) return

  try {
    await appDb.pipeThreads.put({
      key: threadKey(uid, thread.id),
      uid,
      id: Number(thread.id),
      updatedAt: Date.now(),
      value: JSON.stringify(thread),
    })
  } catch { /* кеш не критичен */ }
}

/**
 * Точечно пропатчить поля треда в кеше (счётчики, флаги) без сети.
 *
 * @param uid id текущего пользователя (0 — гость, no-op)
 * @param threadId тред
 * @param patch частичный патч полей
 */
export async function patchCachedThreadFields(
  uid: number,
  threadId: number,
  patch: Partial<PipeThread>,
): Promise<void> {
  if (!(uid > 0) || !(threadId > 0)) return

  try {
    const row = await appDb.pipeThreads.get(threadKey(uid, threadId))
    if (!row) return

    let current: PipeThread
    try {
      current = JSON.parse(row.value)
    } catch {
      return
    }

    await appDb.pipeThreads.put({
      ...row,
      updatedAt: Date.now(),
      value: JSON.stringify({ ...current, ...patch }),
    })
  } catch { /* кеш не критичен */ }
}

/**
 * Удалить тред из кеша целиком: строка + все снапшоты лент аккаунта.
 *
 * @param uid id текущего пользователя (0 — гость, no-op)
 * @param threadId удалённый тред
 */
export async function removeCachedThread(uid: number, threadId: number): Promise<void> {
  if (!(uid > 0) || !(threadId > 0)) return

  try {
    await appDb.pipeThreads.delete(threadKey(uid, threadId))

    const snapshots = await appDb.pipeFeeds.where('uid').equals(uid).toArray()
    for (const row of snapshots) {
      let snapshot: { ids?: unknown; page?: unknown; last_page?: unknown }
      try {
        snapshot = JSON.parse(row.value)
      } catch {
        continue
      }

      const ids = (Array.isArray(snapshot.ids) ? snapshot.ids : [])
        .map((id) => Number(id))
        .filter((id) => id > 0 && id !== threadId)
      const removed = ids.length !== (Array.isArray(snapshot.ids) ? snapshot.ids.length : 0)
      if (!removed) continue

      await appDb.pipeFeeds.put({
        ...row,
        updatedAt: Date.now(),
        value: JSON.stringify({ ids, page: snapshot.page ?? 1, last_page: snapshot.last_page ?? 1 }),
      })
    }
  } catch { /* кеш не критичен */ }
}

/**
 * Новый тред наверх соответствующих снапшотов ленты (свой пост).
 * Снапшоты с поиском не существуют, поэтому матчится только scope.
 *
 * @param uid id текущего пользователя (0 — гость, no-op)
 * @param thread созданный тред
 */
export async function prependCachedThread(uid: number, thread: PipeThread): Promise<void> {
  if (!(uid > 0) || !(Number(thread?.id) > 0)) return

  const threadId = Number(thread.id)
  try {
    await patchCachedThread(uid, thread)

    const snapshots = await appDb.pipeFeeds.where('uid').equals(uid).toArray()
    for (const row of snapshots) {
      const isPlainFeed = row.scope === 'all:0' || row.scope === 'mine:0' || row.scope === 'saved:0'
      if (!isPlainFeed) continue

      let snapshot: { ids?: unknown; page?: unknown; last_page?: unknown }
      try {
        snapshot = JSON.parse(row.value)
      } catch {
        continue
      }

      const ids = (Array.isArray(snapshot.ids) ? snapshot.ids : [])
        .map((id) => Number(id))
        .filter((id) => id > 0 && id !== threadId)
      await appDb.pipeFeeds.put({
        ...row,
        updatedAt: Date.now(),
        value: JSON.stringify({
          ids: [threadId, ...ids].slice(0, MAX_FEED_SNAPSHOT_THREADS),
          page: snapshot.page ?? 1,
          last_page: snapshot.last_page ?? 1,
        }),
      })
    }
  } catch { /* кеш не критичен */ }
}

/**
 * Обрезать кеш тредов аккаунта до лимита (по свежести updatedAt).
 *
 * @param uid id текущего пользователя
 */
export async function prunePipeThreads(uid: number): Promise<void> {
  if (!(uid > 0)) return

  try {
    const count = await appDb.pipeThreads.where('uid').equals(uid).count()
    if (count <= MAX_CACHED_THREADS) return

    const excess = count - MAX_CACHED_THREADS
    const oldest = await appDb.pipeThreads
      .where('uid')
      .equals(uid)
      .sortBy('updatedAt')

    const staleKeys = oldest
      .slice(0, excess)
      .map((row) => row.key)

    if (staleKeys.length > 0) {
      await appDb.pipeThreads.bulkDelete(staleKeys)
    }
  } catch { /* чистка не критична */ }
}

/**
 * Очистить весь pipe-кеш аккаунта (логаут/смена юзера).
 *
 * @param uid id пользователя
 */
export async function clearPipeCache(uid: number): Promise<void> {
  if (!(uid > 0)) return

  try {
    await Promise.all([
      appDb.pipeThreads.where('uid').equals(uid).delete(),
      appDb.pipeFeeds.where('uid').equals(uid).delete(),
    ])
  } catch { /* чистка не критична */ }
}
