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

class AppDb extends Dexie {
  kv!: Table<KvRow, string>
  noteFiles!: Table<NoteFileRow, string>

  constructor() {
    super('upin')
    this.version(1).stores({ kv: 'key' })
    this.version(2).stores({ kv: 'key', noteFiles: 'key, uid' })
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
