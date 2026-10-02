import { defineStore } from 'pinia'
import { savedNotesApi, type SavedNote, type SavedNoteAttachment, type SavedNotesStorage } from '@/services/savedNotes.api'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel } from '@/composables/useUserChannel'
import { noteFileDel, noteFileGet, noteFilePut, noteFilesClear } from '@/db/app.db'

/**
 * Ключ localStorage для локального режима (на пользователя).
 *
 * @param uid id пользователя
 */
function localKey(uid: number): string {
  return `saved-notes:local:${uid}`
}

/**
 * Текущий id пользователя из Inertia-пропсов.
 */
function currentUid(): number {
  try {
    return Number((window as any)?.__inertia_page?.props?.auth?.user?.id || 0)
  } catch {
    return 0
  }
}

/**
 * Определить вид заметки без сервера (как на бэке).
 *
 * @param body текст заметки
 */
function detectKind(body: string): 'text' | 'link' {
  return body.includes('http://') || body.includes('https://') ? 'link' : 'text'
}

/**
 * Живые objectURL локальных вложений (revoke при замене/удалении).
 */
const localUrls = new Map<number, string>()

/**
 * Отозвать objectURL локального вложения.
 *
 * @param noteId id заметки
 */
function revokeLocalUrl(noteId: number): void {
  const prev = localUrls.get(Number(noteId))
  if (prev) {
    try {
      URL.revokeObjectURL(prev)
    } catch {
      /* noop */
    }
    localUrls.delete(Number(noteId))
  }
}

/**
 * Заметка без бинарника для localStorage (blob и url не переживут JSON).
 *
 * @param note заметка с живым вложением
 * @returns копия с метой вложения без blob/url
 */
function toStorable(note: SavedNote): SavedNote {
  const attachment = note.attachment
  if (!attachment) return note
  const { blob: _blob, url: _url, ...meta } = attachment
  return { ...note, attachment: { ...meta, url: null } }
}

/**
 * Подключить живые url к локальным вложениям (blob из IndexedDB).
 *
 * @param uid id пользователя
 * @param notes заметки страницы
 * @returns заметки с url вложений
 */
async function withLocalUrls(uid: number, notes: SavedNote[]): Promise<SavedNote[]> {
  const out: SavedNote[] = []
  for (const note of notes) {
    if (!note.attachment) {
      out.push(note)
      continue
    }
    const id = Number(note.id)
    revokeLocalUrl(id)
    const row = await noteFileGet(uid, id)
    if (!row) {
      out.push({ ...note, attachment: { ...note.attachment, url: null } })
      continue
    }
    const url = URL.createObjectURL(row.blob)
    localUrls.set(id, url)
    out.push({ ...note, attachment: { ...note.attachment, url } })
  }
  return out
}

/**
 * Прочитать локальные заметки этого устройства.
 *
 * @param uid id пользователя
 */
function readLocal(uid: number): SavedNote[] {
  try {
    const raw = localStorage.getItem(localKey(uid))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedNote[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Записать локальные заметки этого устройства.
 *
 * @param uid id пользователя
 * @param notes заметки
 */
function writeLocal(uid: number, notes: SavedNote[]): void {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(notes.slice(0, 2000)))
  } catch {
    /* переполнен — молчим, тост покажет стор */
  }
}

/**
 * Pinia-стор «Избранного» — чата только для себя.
 *
 * Два режима (переключаются в настройках):
 * - server: БД (gzip + AES-256-GCM), синхронизация между устройствами
 *   через сокет `saved-notes.changed`;
 * - local: только localStorage этого браузера, на других устройствах
 *   данные не видны и не синхронизируются.
 */
export const useSavedNotesStore = defineStore('savedNotes', {
  state: () => ({
    notes: [] as SavedNote[],
    total: 0,
    page: 1,
    lastPage: 1,
    hasMore: false,
    loading: false,
    saving: false,
    storage: 'server' as SavedNotesStorage,
    storageLoading: true,
    search: '',
    kind: 'all' as 'all' | 'text' | 'link',
    error: null as string | null,
    realtimeBound: false,
  }),

  getters: {
    /**
     * Заметок нет вообще (и не грузятся).
     */
    isEmpty(state): boolean {
      return !state.loading && state.notes.length === 0
    },

    /**
     * Локальный ли режим (без синхронизации).
     */
    isLocal(state): boolean {
      return state.storage === 'local'
    },
  },

  actions: {
    /**
     * Инициализация: режим хранения + первая страница + сокет.
     */
    async init(): Promise<void> {
      await this.loadStorage()
      this.bindRealtime()
      await this.reload()
    },

    /**
     * Подписка на изменения с других устройств (только server-режим).
     */
    bindRealtime(): void {
      if (this.realtimeBound) return
      this.realtimeBound = true
      try {
        ensureUserChannel()
      } catch {
        /* без сокета живём на ручном обновлении */
      }
      busOn('user:saved-notes.changed', () => {
        void this.handleRemoteChanged()
      })
    },

    /**
     * Перезагрузить список после сокет-события.
     */
    async handleRemoteChanged(): Promise<void> {
      if (this.storage !== 'server') return
      await this.reload()
    },

    /**
     * Загрузить режим хранения с сервера.
     */
    async loadStorage(): Promise<void> {
      this.storageLoading = true
      try {
        const res = await savedNotesApi.getSettings()
        this.storage = res.storage === 'local' ? 'local' : 'server'
      } catch {
        this.storage = 'server'
      } finally {
        this.storageLoading = false
      }
    },

    /**
     * Переключить режим хранения.
     *
     * Выбор сохраняется на сервере всегда (даже для local) — чтобы
     * пометка «не синхронизируется» была видна отовсюду.
     *
     * @param mode server|local
     */
    async setStorage(mode: SavedNotesStorage): Promise<boolean> {
      if (mode !== 'server' && mode !== 'local') {
        return false
      }
      if (mode === this.storage) {
        return true
      }
      const prev = this.storage
      this.storage = mode
      try {
        const res = await savedNotesApi.updateSettings(mode)
        this.storage = res.storage
      } catch (e) {
        this.storage = prev
        return false
      }
      this.page = 1
      await this.reload()
      return true
    },

    /**
     * Первая страница с текущим поиском.
     */
    async reload(): Promise<void> {
      this.page = 1
      await this.load(false)
    },

    /**
     * Загрузить страницу (server — REST, local — localStorage).
     *
     * @param append приклеить к списку (пагинация вниз)
     */
    async load(append = false): Promise<void> {
      if (this.storage === 'local') {
        await this.loadFromLocal(append)
        return
      }
      await this.loadFromServer(append)
    },

    /**
     * Следующая страница.
     */
    async loadMore(): Promise<void> {
      if (this.loading || !this.hasMore) return
      this.page += 1
      await this.load(true)
    },

    /**
     * Установить поиск и перезагрузить.
     *
     * @param q подстрока поиска
     */
    async setSearch(q: string): Promise<void> {
      this.search = q
      await this.reload()
    },

    /**
     * Установить фильтр вида и перезагрузить.
     *
     * @param kind all|text|link
     */
    async setKind(kind: 'all' | 'text' | 'link'): Promise<void> {
      this.kind = kind
      await this.reload()
    },

    /**
     * Страница с сервера (тела уже расшифрованы бэком).
     *
     * @param append приклеить к списку
     */
    async loadFromServer(append: boolean): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const res = await savedNotesApi.list({
          q: this.search.trim() || undefined,
          kind: this.kind,
          page: this.page,
          per_page: 20,
        })
        const rows = Array.isArray(res.data) ? res.data : []
        this.notes = append ? [...this.notes, ...rows] : rows
        this.total = Number(res.total || 0)
        this.lastPage = Number(res.last_page || 1)
        this.hasMore = !!res.has_more
      } catch {
        this.error = 'Не получилось загрузить заметки'
        if (!append) this.notes = []
      } finally {
        this.loading = false
      }
    },

    /**
     * Страница из localStorage (поиск и фильтр — в памяти).
     *
     * Поиск ловит и имена вложений. Блобы догружаются из IndexedDB,
     * в ленту встают живые objectURL.
     *
     * @param append приклеить к списку
     */
    async loadFromLocal(append: boolean): Promise<void> {
      const uid = currentUid()
      const all = readLocal(uid)
      const needle = this.search.trim().toLowerCase()
      const filtered = all.filter((note) => {
        const kindOk = this.kind === 'all' || note.kind === this.kind
        if (!kindOk) return false
        if (needle === '') return true
        const haystack = `${note.body}\n${note.attachment?.name ?? ''}`.toLowerCase()
        return haystack.includes(needle)
      })
      const perPage = 20
      const slice = filtered.slice(0, this.page * perPage)
      this.notes = await withLocalUrls(uid, slice)
      this.total = filtered.length
      this.lastPage = Math.max(1, Math.ceil(filtered.length / perPage))
      this.hasMore = slice.length < filtered.length
      this.error = null
      this.loading = false
    },

    /**
     * Создать заметку.
     *
     * Пустой текст допустим только с вложением (картинка/файл сами
     * по себе — как в чате): подписью станет имя файла.
     *
     * @param body текст заметки
     * @param file опциональное вложение
     * @param fileKind image|file для локального режима
     * @returns true когда сохранено
     */
    async create(body: string, file?: File | null, fileKind?: string): Promise<boolean> {
      const clean = body.trim().slice(0, 10000)
      const caption = clean === '' && file ? file.name.slice(0, 200) : clean
      if (caption === '') return false
      this.saving = true
      try {
        if (this.storage === 'local') {
          const uid = currentUid()
          const now = new Date().toISOString()
          const note: SavedNote = {
            id: Date.now(),
            body: caption,
            kind: detectKind(caption),
            created_at: now,
            updated_at: now,
          }
          if (file) {
            const kind = fileKind === 'image' ? 'image' : 'file'
            await noteFilePut(uid, note.id, file, kind)
            note.attachment = {
              url: null,
              name: file.name,
              mime: file.type || 'application/octet-stream',
              size: file.size,
              kind,
            }
          }
          writeLocal(uid, [toStorable(note), ...readLocal(uid)])
          await this.reload()
          return true
        }
        const created = await savedNotesApi.create(caption, file ?? null)
        this.notes = [created, ...this.notes]
        this.total += 1
        return true
      } catch {
        this.error = 'Не получилось сохранить заметку'
        return false
      } finally {
        this.saving = false
      }
    },

    /**
     * Обновить текст и вложение заметки.
     *
     * @param id id заметки
     * @param body новый текст
     * @param file новое вложение (заменяет старое)
     * @param fileKind image|file для локального режима
     * @param removeAttachment убрать вложение без замены
     * @returns true когда сохранено
     */
    async updateNote(id: number, body: string, file?: File | null, fileKind?: string, removeAttachment?: boolean): Promise<boolean> {
      const clean = body.trim()
      if (clean === '') return false
      this.saving = true
      try {
        if (this.storage === 'local') {
          const uid = currentUid()
          const kind = fileKind === 'image' ? 'image' : 'file'
          if (file) {
            await noteFilePut(uid, Number(id), file, kind)
          } else if (removeAttachment) {
            await noteFileDel(uid, Number(id))
            revokeLocalUrl(Number(id))
          }
          const next = readLocal(uid).map((note) => {
            if (Number(note.id) !== Number(id)) return note
            const base = {
              ...note,
              body: clean.slice(0, 10000),
              kind: detectKind(clean),
              updated_at: new Date().toISOString(),
            }
            if (file) {
              base.attachment = { url: null, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, kind }
            } else if (removeAttachment) {
              base.attachment = null
            }
            return base
          })
          writeLocal(uid, next.map(toStorable))
          await this.reload()
          return true
        }
        const updated = await savedNotesApi.update(id, clean, file ?? null, removeAttachment)
        this.notes = this.notes.map((note) => (Number(note.id) === Number(id) ? updated : note))
        return true
      } catch {
        this.error = 'Не получилось обновить заметку'
        return false
      } finally {
        this.saving = false
      }
    },

    /**
     * Удалить одну заметку.
     *
     * @param id id заметки
     */
    async removeNote(id: number): Promise<boolean> {
      try {
        if (this.storage === 'local') {
          const uid = currentUid()
          await noteFileDel(uid, Number(id))
          revokeLocalUrl(Number(id))
          writeLocal(
            uid,
            readLocal(uid).filter((note) => Number(note.id) !== Number(id)),
          )
          await this.reload()
          return true
        }
        await savedNotesApi.remove(id)
        this.notes = this.notes.filter((note) => Number(note.id) !== Number(id))
        this.total = Math.max(0, this.total - 1)
        return true
      } catch {
        this.error = 'Не получилось удалить заметку'
        return false
      }
    },

    /**
     * Удалить все заметки (после подтверждения в компоненте).
     */
    async clearAll(): Promise<boolean> {
      try {
        if (this.storage === 'local') {
          const uid = currentUid()
          for (const [noteId] of localUrls) {
            revokeLocalUrl(noteId)
          }
          await noteFilesClear(uid)
          writeLocal(uid, [])
          await this.reload()
          return true
        }
        await savedNotesApi.clear()
        this.notes = []
        this.total = 0
        this.hasMore = false
        return true
      } catch {
        this.error = 'Не получилось очистить избранное'
        return false
      }
    },
  },
})
