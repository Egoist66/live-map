import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { chatApi } from '@/services/chat.api'
import { useFileDownload } from '@/composables/useFileDownload'
import { getAvatarUrl } from '@/composables/useAvatar'
import type { Conversation } from '@/types/entities/Chat'

/**
 * Пункт селекта чата для выгрузки.
 *
 * Аватар — готовый URL собеседника (null — показать инициалы),
 * у районных чатов вместо аватара рисуется домик-тайл (isDistrict).
 */
export interface ChatExportOption {
  id: number
  label: string
  sub: string | null
  avatar: string | null
  isDistrict: boolean
}

const PAGE_SIZE = 50
const MAX_PAGES = 10

/**
 * Выгрузка переписки в HTML из раздела статистики.
 *
 * Список диалогов тянем лениво (по фокусу селекта), постранично —
 * бэк отдаёт максимум 50 штук за раз. Сам файл качаем blob-ом
 * через useFileDownload: браузер сразу сохраняет .html с нужным именем.
 * Компонент только отображает, вся механика — здесь.
 *
 * @returns опции чатов, выбор, загрузка и выгрузка
 * @example
 * ```ts
 * const chatExport = useChatExport()
 * await chatExport.exportSelected()
 * ```
 */
export function useChatExport() {
  const options = ref<ChatExportOption[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const selectedId = ref<number | null>(null)
  const exporting = ref(false)

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as any
    }
  })()

  const downloader = useFileDownload()

  const selected = computed(() => options.value.find((option) => option.id === selectedId.value) ?? null)
  const canExport = computed(() => selectedId.value !== null && exporting.value === false)

  /**
   * Подпись диалога: район, имя собеседника или номер.
   *
   * @param conversation диалог с бэка
   */
  function labelFor(conversation: Conversation): string {
    const title = (conversation.title || '').trim()

    if (title !== '') {
      return title
    }

    const name = ((conversation.other as any)?.name || '').trim()

    if (name !== '') {
      return name
    }

    return `Чат №${conversation.id}`
  }

  /**
   * Подзаголовок пункта: тип диалога.
   *
   * @param conversation диалог с бэка
   */
  function subFor(conversation: Conversation): string | null {
    if (conversation.type === 'district') {
      return 'Общий чат района'
    }

    if ((conversation.other as any)?.is_match) {
      return 'Мэтч в ULove'
    }

    return null
  }

  /**
   * Подгрузить все диалоги для селекта (лениво, один раз).
   */
  async function load(): Promise<void> {
    if (loading.value || loaded.value) {
      return
    }

    loading.value = true

    try {
      const all: Conversation[] = []
      let page = 1

      for (let fetched = 0; fetched < MAX_PAGES; fetched += 1) {
        const res = await chatApi.conversationsPage(page, PAGE_SIZE)

        for (const row of res.data) {
          all.push(row)
        }

        if (!res.has_more) {
          break
        }

        page += 1
      }

      options.value = all.map((row) => {
        const isDistrict = row.type === 'district'

        return {
          id: row.id,
          label: labelFor(row),
          sub: subFor(row),
          avatar: isDistrict ? null : getAvatarUrl(row.other),
          isDistrict,
        }
      })
      loaded.value = true
    } catch {
      toast?.add({ severity: 'error', summary: 'Не загрузилось', detail: 'Не удалось получить список чатов', life: 4000 })
    } finally {
      loading.value = false
    }
  }

  /**
   * Имя сохраняемого файла: только латиница и цифры.
   */
  function fileNameFor(id: number): string {
    const day = new Date().toISOString().slice(0, 10)

    return `chat-${id}-${day}.html`
  }

  /**
   * Скачать выбранную переписку HTML-файлом.
   */
  async function exportSelected(): Promise<void> {
    if (selectedId.value === null || exporting.value) {
      return
    }

    const id = selectedId.value
    exporting.value = true

    try {
      const ok = await downloader.download(chatApi.exportConversationHtmlUrl(id), fileNameFor(id))

      if (ok) {
        toast?.add({ severity: 'success', summary: 'Готово', detail: 'Переписка сохранена в HTML', life: 3500 })
      } else {
        toast?.add({ severity: 'error', summary: 'Не получилось', detail: 'Файл не скачался, попробуйте ещё раз', life: 4000 })
      }
    } catch {
      toast?.add({ severity: 'error', summary: 'Не получилось', detail: 'Файл не скачался, попробуйте ещё раз', life: 4000 })
    } finally {
      exporting.value = false
    }
  }

  return {
    options,
    loading,
    loaded,
    selectedId,
    selected,
    canExport,
    exporting,
    load,
    exportSelected,
  }
}
