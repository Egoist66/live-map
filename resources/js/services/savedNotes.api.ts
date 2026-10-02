import { api } from './api'

/**
 * Вложение заметки «Избранного».
 *
 * Server-режим: url — публичная ссылка с бэка.
 * Local-режим: blob — файл из IndexedDB, url — временный objectURL.
 */
export interface SavedNoteAttachment {
  url: string | null
  name: string | null
  mime: string | null
  size: number | null
  kind: string
  blob?: Blob | null
}

/**
 * Заметка «Избранного» (чат только для себя).
 */
export interface SavedNote {
  id: number
  body: string
  kind: 'text' | 'link'
  attachment?: SavedNoteAttachment | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Режим хранения заметок.
 * - server: в БД сжато и зашифровано, синхронизируется между устройствами;
 * - local: только localStorage этого браузера, на других устройствах не видно.
 */
export type SavedNotesStorage = 'server' | 'local'

/**
 * Страница списка заметок.
 */
export interface SavedNotesPage {
  data: SavedNote[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  has_more: boolean
}

/**
 * REST-клиент «Избранного».
 *
 * Все методы — async/await, ошибки пробрасываются вызывающему
 * (текст для тоста берёт хук useSavedNotes).
 */
export const savedNotesApi = {
  /**
   * Страница заметок с поиском.
   *
   * @param params q, kind, page, per_page
   */
  async list(params: { q?: string; kind?: 'all' | 'text' | 'link'; page?: number; per_page?: number } = {}): Promise<SavedNotesPage> {
    const { data } = await api.get('/api/saved-notes', { params })
    return data as SavedNotesPage
  },

  /**
   * Создать заметку.
   *
   * @param body текст заметки (1..10000 символов)
   * @param file опциональное вложение (картинка/документ до 10 МБ)
   */
  async create(body: string, file?: File | null): Promise<SavedNote> {
    if (!file) {
      const { data } = await api.post('/api/saved-notes', { body })
      return data as SavedNote
    }
    const form = new FormData()
    form.append('body', body)
    form.append('attachment', file, file.name)
    const { data } = await api.post('/api/saved-notes', form)
    return data as SavedNote
  },

  /**
   * Обновить текст и вложение заметки.
   *
   * Файл идёт multipart через POST + _method=PATCH: PHP не разбирает
   * файлы в теле PATCH-запроса, без spoofing вложение бы терялось.
   *
   * @param id id заметки
   * @param body новый текст
   * @param file новое вложение (заменяет старое)
   * @param removeAttachment убрать вложение без замены
   */
  async update(id: number, body: string, file?: File | null, removeAttachment?: boolean): Promise<SavedNote> {
    if (!file && !removeAttachment) {
      const { data } = await api.patch(`/api/saved-notes/${id}`, { body })
      return data as SavedNote
    }
    const form = new FormData()
    form.append('_method', 'PATCH')
    form.append('body', body)
    if (file) {
      form.append('attachment', file, file.name)
    }
    if (removeAttachment) {
      form.append('remove_attachment', '1')
    }
    const { data } = await api.post(`/api/saved-notes/${id}`, form)
    return data as SavedNote
  },

  /**
   * Удалить одну заметку.
   *
   * @param id id заметки
   */
  async remove(id: number): Promise<void> {
    await api.delete(`/api/saved-notes/${id}`)
  },

  /**
   * Удалить все заметки владельца.
   */
  async clear(): Promise<{ ok: boolean; deleted: number }> {
    const { data } = await api.delete('/api/saved-notes')
    return data as { ok: boolean; deleted: number }
  },

  /**
   * Текущий режим хранения (server|local).
   */
  async getSettings(): Promise<{ storage: SavedNotesStorage }> {
    const { data } = await api.get('/api/saved-notes/settings')
    return data as { storage: SavedNotesStorage }
  },

  /**
   * Переключить режим хранения.
   *
   * @param storage server|local
   */
  async updateSettings(storage: SavedNotesStorage): Promise<{ storage: SavedNotesStorage }> {
    const { data } = await api.patch('/api/saved-notes/settings', { storage })
    return data as { storage: SavedNotesStorage }
  },
}
