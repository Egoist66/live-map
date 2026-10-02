import { api } from './api'

/**
 * Заметка «Избранного» (чат только для себя).
 */
export interface SavedNote {
  id: number
  body: string
  kind: 'text' | 'link'
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
   */
  async create(body: string): Promise<SavedNote> {
    const { data } = await api.post('/api/saved-notes', { body })
    return data as SavedNote
  },

  /**
   * Обновить текст заметки.
   *
   * @param id id заметки
   * @param body новый текст
   */
  async update(id: number, body: string): Promise<SavedNote> {
    const { data } = await api.patch(`/api/saved-notes/${id}`, { body })
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
