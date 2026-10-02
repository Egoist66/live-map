import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSavedNotesStore } from '@/stores/savedNotes'

/**
 * Хук «Избранного» — чата только для себя (Правило №1: логика здесь, не в компоненте).
 *
 * Тонкая обёртка над pinia-стором: компонент берёт состояние и действия
 * одной строкой и только отображает. Режимы хранения:
 * - server: БД (gzip + AES-256-GCM), синхронизация между устройствами;
 * - local: только localStorage этого браузера (без синхронизации).
 *
 * @example
 * const { state, actions } = useSavedNotes()
 * await actions.init()
 *
 * @returns состояние (ref) и действия стора
 */
export function useSavedNotes() {
  const store = useSavedNotesStore()
  const refs = storeToRefs(store)

  const state = {
    notes: refs.notes,
    total: refs.total,
    page: refs.page,
    lastPage: refs.lastPage,
    hasMore: refs.hasMore,
    loading: refs.loading,
    saving: refs.saving,
    storage: refs.storage,
    storageLoading: refs.storageLoading,
    search: refs.search,
    kind: refs.kind,
    error: refs.error,
  }

  const actions = {
    init: (): Promise<void> => store.init(),
    reload: (): Promise<void> => store.reload(),
    loadMore: (): Promise<void> => store.loadMore(),
    setSearch: (q: string): Promise<void> => store.setSearch(q),
    setKind: (kind: 'all' | 'text' | 'link'): Promise<void> => store.setKind(kind),
    setStorage: (mode: 'server' | 'local'): Promise<boolean> => store.setStorage(mode),
    create: (body: string, file?: File | null, fileKind?: string): Promise<boolean> => store.create(body, file, fileKind),
    updateNote: (id: number, body: string, file?: File | null, fileKind?: string, removeAttachment?: boolean): Promise<boolean> =>
      store.updateNote(id, body, file, fileKind, removeAttachment),
    removeNote: (id: number): Promise<boolean> => store.removeNote(id),
    clearAll: (): Promise<boolean> => store.clearAll(),
  }

  /**
   * Подсказка про локальный режим для пустых/предупреждающих мест.
   */
  const localHint = computed(() =>
    state.storage.value === 'local'
      ? 'Локальный режим: хранится только на этом устройстве и не синхронизируется.'
      : 'Синхронизируется между устройствами (сжато и зашифровано).',
  )

  return { state, actions, localHint }
}
