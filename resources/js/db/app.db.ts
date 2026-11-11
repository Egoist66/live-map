import Dexie, { type Table } from 'dexie'

interface KvRow {
  key: string
  value: string
}

/**
 * Файл вложения локальной заметки «Избранного».
 *
 * localStorage для файлов не годится (квота ~5 МБ, синхронный API),
 * поэтому бинарники живут в IndexedDB, а в localStorage — только
 * метаданные заметки. key — `${uid}:${noteId}`.
 */
export interface NoteFileRow {
  key: string
  uid: number
  name: string
  mime: string
  size: number
  kind: string
  blob: Blob
}

/**
 * Закешированный диалог из сайдбара чата.
 *
 * key — `${uid}:${conversationId}`: кеш строго per-аккаунт, чтобы
 * после смены юзера без перезагрузки не светить чужие диалоги.
 * value — сырой payload диалога с сервера (как от chatApi).
 */
export interface CachedConversationRow {
  key: string
  uid: number
  convId: number
  updatedAt: number
  value: string
}

/**
 * Закешированное сообщение открытого диалога.
 *
 * key — `${uid}:${messageId}` (id глобально уникальны, но изоляция
 * по uid обязательна — приватность). convId — для выборки хвоста
 * диалога одним запросом.
 */
export interface CachedMessageRow {
  key: string
  uid: number
  convId: number
  id: number
  createdAt: number
  value: string
}

/**
 * Закешированный список галереи пользователя.
 *
 * key — `${viewerUid}:${ownerId}`: свою галерею кешируем отдельно
 * от чужих просмотренных. value — сырой GalleryIndex с сервера.
 */
export interface CachedGalleryRow {
  key: string
  uid: number
  ownerId: number
  updatedAt: number
  value: string
}

/**
 * Закешированный снапшот шапки профиля (аватар, имя, счётчики).
 *
 * key — `${viewerUid}:${ownerId}`. value — минимальный набор полей,
 * нужный для мгновенного рендера шапки до ответа сервера.
 */
export interface CachedProfileRow {
  key: string
  uid: number
  ownerId: number
  updatedAt: number
  value: string
}

/**
 * Закешированный бинарник картинки (аватар, thumb галереи).
 *
 * hash — djb2-хеш нормализованного URL (без ?v= версии).
 * Храним только маленькие (аватар/превью ≤250 КБ): большие оригиналы
 * остаются на HTTP-кеше браузера, иначе упираемся в квоту Safari.
 */
export interface CachedImageRow {
  hash: string
  url: string
  mime: string
  size: number
  lastUsed: number
  blob: Blob
}

/**
 * Курсор дельта-синхронизации скоупа.
 *
 * key — `${uid}:${scope}` (scope: conversations|messages:{convId}|gallery:{ownerId}).
 * cursor — server_time последнего успешного синка (ms).
 */
export interface SyncMetaRow {
  key: string
  uid: number
  cursor: number
}

/**
 * Закешированный тред Pipe.
 *
 * key — `${uid}:${threadId}`: изоляция по аккаунту, как в чатах.
 * value — сырой payload треда (как от pipeApi), патчится точечно
 * (лайки, закладки, счётчики) и живёт до 200 штук на аккаунт.
 */
export interface CachedPipeThreadRow {
  key: string
  uid: number
  id: number
  updatedAt: number
  value: string
}

/**
 * Снапшот ленты Pipe (какой scope и в каком порядке показывать треды).
 *
 * key — `${uid}:${scope}`, scope — `${filter}:${authorId ?? 0}`
 * (например `all:0`, `mine:0`, `saved:0`, `all:42`). value — JSON
 * `{ ids: number[], page, last_page }`; сами треды лежат в pipeThreads.
 */
export interface CachedPipeFeedRow {
  key: string
  uid: number
  scope: string
  updatedAt: number
  value: string
}

/**
 * Локальная настройка скринлокера пользователя.
 *
 * Персональный код блокировки — приватная настройка устройства, а не
 * данные аккаунта: на бэкенд не уходит и хранится под ключом uid, чтобы
 * после смены пользователя без перезагрузки не включался чужой локер.
 * codeHash === null означает «выключено»; сам PIN/пароль не хранится.
 */
export interface ScreenLockRow {
  uid: number
  codeHash: string | null
  timeout: number
  kind: string
  updatedAt: number
}

class AppDb extends Dexie {
  kv!: Table<KvRow, string>
  noteFiles!: Table<NoteFileRow, string>
  chatConversations!: Table<CachedConversationRow, string>
  chatMessages!: Table<CachedMessageRow, string>
  galleries!: Table<CachedGalleryRow, string>
  profileHeaders!: Table<CachedProfileRow, string>
  imageBlobs!: Table<CachedImageRow, string>
  syncMeta!: Table<SyncMetaRow, string>
  screenLock!: Table<ScreenLockRow, number>
  pipeThreads!: Table<CachedPipeThreadRow, string>
  pipeFeeds!: Table<CachedPipeFeedRow, string>

  constructor() {
    super('upin')
    this.version(1).stores({ kv: 'key' })
    this.version(2).stores({ kv: 'key', noteFiles: 'key, uid' })
    this.version(3).stores({
      kv: 'key',
      noteFiles: 'key, uid',
      chatConversations: 'key, uid, convId',
      chatMessages: 'key, uid, convId, id',
      galleries: 'key, uid, ownerId',
      profileHeaders: 'key, uid, ownerId',
      imageBlobs: 'hash, lastUsed',
      syncMeta: 'key, uid',
    })
    this.version(4).stores({
      kv: 'key',
      noteFiles: 'key, uid',
      chatConversations: 'key, uid, convId',
      chatMessages: 'key, uid, convId, id',
      galleries: 'key, uid, ownerId',
      profileHeaders: 'key, uid, ownerId',
      imageBlobs: 'hash, lastUsed',
      syncMeta: 'key, uid',
      screenLock: 'uid',
    })
    this.version(5).stores({
      kv: 'key',
      noteFiles: 'key, uid',
      chatConversations: 'key, uid, convId',
      chatMessages: 'key, uid, convId, id',
      galleries: 'key, uid, ownerId',
      profileHeaders: 'key, uid, ownerId',
      imageBlobs: 'hash, lastUsed',
      syncMeta: 'key, uid',
      screenLock: 'uid',
      pipeThreads: 'key, uid, id, updatedAt',
      pipeFeeds: 'key, uid, updatedAt',
    })
  }
}

export const appDb = new AppDb()

export async function kvGet(key: string): Promise<string | null> {
  try {
    const row = await appDb.kv.get(key)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    await appDb.kv.put({ key, value })
  } catch {}
}

export async function kvDel(key: string): Promise<void> {
  try {
    await appDb.kv.delete(key)
  } catch {}
}

/**
 * Ключ файла локальной заметки.
 *
 * @param uid id пользователя
 * @param noteId id заметки (локальный — Date.now())
 */
export function noteFileKey(uid: number, noteId: number): string {
  return `saved-note:${uid}:${noteId}`
}

/**
 * Сохранить файл локальной заметки в IndexedDB.
 *
 * @param uid id пользователя
 * @param noteId id заметки
 * @param file исходный файл
 * @param kind image|file
 */
export async function noteFilePut(uid: number, noteId: number, file: File, kind: string): Promise<void> {
  try {
    await appDb.noteFiles.put({
      key: noteFileKey(uid, noteId),
      uid,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      kind,
      blob: file,
    })
  } catch {}
}

/**
 * Прочитать файл локальной заметки.
 *
 * @param uid id пользователя
 * @param noteId id заметки
 * @returns строка файла или null
 */
export async function noteFileGet(uid: number, noteId: number): Promise<NoteFileRow | null> {
  try {
    return (await appDb.noteFiles.get(noteFileKey(uid, noteId))) ?? null
  } catch {
    return null
  }
}

/**
 * Удалить файл локальной заметки.
 *
 * @param uid id пользователя
 * @param noteId id заметки
 */
export async function noteFileDel(uid: number, noteId: number): Promise<void> {
  try {
    await appDb.noteFiles.delete(noteFileKey(uid, noteId))
  } catch {}
}

/**
 * Удалить все файлы локальных заметок пользователя.
 *
 * @param uid id пользователя
 */
export async function noteFilesClear(uid: number): Promise<void> {
  try {
    await appDb.noteFiles.where('uid').equals(uid).delete()
  } catch {}
}
