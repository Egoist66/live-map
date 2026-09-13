import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

/** Элемент архива вложений. */
export type ArchiveItem = {
  id: number
  conversation_id: number
  chat_with: { id: number; name: string } | null
  attachment: { url: string | null; name: string | null; mime: string | null; size: number | null; kind: 'image' | 'file' | null } | null
  /** API-роут скачивания с корректным именем и кодировкой. */
  download_url: string | null
  created_at: string | null
  expires_at: string | null
}

/**
 * Архив отправленных документов из чатов.
 * Список, удаление по одному и очистка всего.
 * @example
 * const { items, fetchAll, removeOne, clearAll } = useSettingsArchive()
 */
export function useSettingsArchive() {
  const items = ref<ArchiveItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const deletingId = ref<number | null>(null)
  const clearing = ref(false)

  /**
   * Загружает первую страницу архива.
   */
  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const page = await chatApi.attachments(1)
      const list = Array.isArray(page) ? page : page?.data ?? []
      items.value = list
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить архив'
    } finally {
      loading.value = false
    }
  }

  /**
   * Удаляет одно вложение из БД и с диска.
   * @param id id сообщения с вложением
   */
  async function removeOne(id: number): Promise<void> {
    deletingId.value = id
    try {
      await chatApi.deleteAttachment(id)
      items.value = items.value.filter((x) => x.id !== id)
    } finally {
      deletingId.value = null
    }
  }

  /**
   * Удаляет все вложения пользователя.
   */
  async function clearAll(): Promise<void> {
    clearing.value = true
    try {
      await chatApi.clearAttachments()
      items.value = []
    } finally {
      clearing.value = false
    }
  }

  /**
   * Форматирует размер файла.
   * @param size байты
   * @returns строка вида "1.2 МБ"
   */
  function formatSize(size: number | null | undefined): string {
    const bytes = Number(size) || 0
    if (bytes < 1024) {
      return `${bytes} Б`
    }
    const kb = bytes / 1024
    if (kb < 1024) {
      return `${kb.toFixed(0)} КБ`
    }
    return `${(kb / 1024).toFixed(1)} МБ`
  }

  /**
   * Остаток хранения до автоудаления.
   * @param expiresAt ISO-дата истечения
   * @returns строка вида "через 7 дн."
   */
  function expiresIn(expiresAt: string | null): string {
    if (!expiresAt) {
      return ''
    }
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (!Number.isFinite(ms) || ms <= 0) {
      return 'истекает'
    }
    const days = Math.ceil(ms / 86400000)
    return days >= 2 ? `ещё ${days} дн.` : 'меньше суток'
  }

  return { items, loading, error, deletingId, clearing, fetchAll, removeOne, clearAll, formatSize, expiresIn }
}
