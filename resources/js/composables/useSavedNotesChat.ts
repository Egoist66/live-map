import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useSavedNotes } from '@/composables/useSavedNotes'
import { useEnterToSend } from '@/composables/useEnterToSend'
import { chatFileExt, isChatImage } from '@/composables/useChatAttachment'
import { formatTime } from '@/utils/date'

/** Макс вес вложения в «Избранном»: 10 МБ, как в чате. */
const NOTE_MAX_BYTES = 10 * 1024 * 1024

const NOTE_ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip']

const NOTE_FORBIDDEN_EXTS = [
  'php', 'phtml', 'phar', 'exe', 'msi', 'bat', 'cmd', 'com', 'scr',
  'sh', 'bash', 'zsh', 'js', 'mjs', 'html', 'htm', 'svg', 'jar',
  'ps1', 'vbs', 'dll', 'so', 'dylib', 'apk', 'deb', 'rpm',
]

/**
 * Чат с собой («Избранное») — вся логика в одном месте (Правило №1).
 *
 * Компонент `SavedNotesChat` только рисует: шапка, лента из
 * MessageBubble, композер с вложениями. Умности: ссылки кликабельны
 * (MessageBubble), вставка картинок из буфера, поиск, edit/delete.
 *
 * @example
 * const chat = useSavedNotesChat()
 *
 * @returns состояние ленты, композера, поиска и действия
 */
export function useSavedNotesChat() {
  const { state, actions, localHint } = useSavedNotes()
  const { handleEnterToSend } = useEnterToSend()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as any
    }
  })()
  const confirm = (() => {
    try {
      return useConfirm()
    } catch {
      return null as any
    }
  })()

  const draft = ref('')
  const file = ref<File | null>(null)
  const previewUrl = ref<string | null>(null)
  const attachError = ref<string | null>(null)
  const editingId = ref<number | null>(null)
  const editingBody = ref('')
  const editingRemoveFile = ref(false)
  const showSearch = ref(false)
  const query = ref('')
  const listEl = ref<HTMLElement | null>(null)

  let queryTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Заметки в хронологическом порядке (стор отдаёт свежие первыми).
   */
  const ordered = computed(() => [...state.notes.value].reverse())

  /**
   * Сообщения для MessageBubble: свои, с флагом edited и вложением.
   */
  const messages = computed(() =>
    ordered.value.map((note) => ({
      id: note.id,
      body: note.body,
      attachment: note.attachment?.url
        ? {
          url: note.attachment.url,
          name: note.attachment.name,
          mime: note.attachment.mime,
          size: note.attachment.size,
          kind: note.attachment.kind,
        }
        : null,
      created_at: note.created_at,
      is_edited: !!note.updated_at && !!note.created_at && note.updated_at !== note.created_at,
    })),
  )

  const canSend = computed(() => draft.value.trim() !== '' || file.value !== null)

  /**
   * Привязать скролл-контейнер ленты для автопрокрутки.
   *
   * @param el элемент ленты
   */
  function bindList(el: unknown): void {
    listEl.value = (el as HTMLElement | null) ?? null
  }

  /**
   * Прокрутить ленту вниз (после отправки и первой загрузки).
   */
  function scrollToBottom(): void {
    requestAnimationFrame(() => {
      const el = listEl.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  /**
   * Проверить файл до отправки: тип и вес (правила — как в чате).
   *
   * @param target исходный файл
   * @returns текст ошибки или null если ок
   */
  function validateNoteFile(target: File): string | null {
    const ext = chatFileExt(target.name)
    const parts = String(target.name || '').toLowerCase().split('.')
    if (parts.some((p) => NOTE_FORBIDDEN_EXTS.includes(p))) {
      return 'Такой тип файла запрещён'
    }
    if (!NOTE_ALLOWED_EXTS.includes(ext)) {
      return 'Можно фото (jpg, png, webp, gif) и документы (pdf, doc, docx, xls, xlsx, txt, zip)'
    }
    if (target.size > NOTE_MAX_BYTES) {
      return 'Файл слишком большой (макс 10 МБ)'
    }
    return null
  }

  /**
   * Положить файл в композер с превью.
   *
   * @param target исходный файл
   */
  function pickFile(target: File | null): void {
    attachError.value = null
    if (!target) return
    const err = validateNoteFile(target)
    if (err) {
      attachError.value = err
      return
    }
    clearPreview()
    file.value = target
    try {
      previewUrl.value = isChatImage(target.name) ? URL.createObjectURL(target) : null
    } catch {
      previewUrl.value = null
    }
  }

  /**
   * Убрать файл из композера.
   */
  function clearPreview(): void {
    if (previewUrl.value) {
      try {
        URL.revokeObjectURL(previewUrl.value)
      } catch {
        /* noop */
      }
    }
    previewUrl.value = null
    file.value = null
  }

  /**
   * Вставка картинки из буфера обмена прямо в композер.
   *
   * @param event событие вставки
   */
  function onPasteImage(event: ClipboardEvent): void {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const pasted = item.getAsFile()
        if (pasted) {
          event.preventDefault()
          pickFile(pasted)
          return
        }
      }
    }
  }

  /**
   * Отправить сообщение себе: текст и/или вложение.
   */
  async function send(): Promise<void> {
    if (!canSend.value || state.saving.value) return
    const kind = file.value && isChatImage(file.value.name) ? 'image' : 'file'
    const ok = await actions.create(draft.value, file.value, kind)
    if (!ok) {
      toast?.add({ severity: 'error', summary: 'Не сохранено', detail: state.error.value || 'Попробуйте позже', life: 3500 })
      return
    }
    draft.value = ''
    clearPreview()
    scrollToBottom()
  }

  /**
   * Начать редактирование заметки.
   *
   * @param message сообщение из ленты
   */
  function startEdit(message: any): void {
    editingId.value = Number(message?.id)
    editingBody.value = String(message?.body ?? '')
    editingRemoveFile.value = false
  }

  /**
   * Сохранить отредактированный текст.
   */
  async function saveEdit(): Promise<void> {
    if (editingId.value == null) return
    const ok = await actions.updateNote(editingId.value, editingBody.value, null, undefined, editingRemoveFile.value || undefined)
    if (!ok) {
      toast?.add({ severity: 'error', summary: 'Не обновлено', detail: state.error.value || 'Попробуйте позже', life: 3500 })
      return
    }
    cancelEdit()
  }

  /**
   * Выйти из редактирования.
   */
  function cancelEdit(): void {
    editingId.value = null
    editingBody.value = ''
    editingRemoveFile.value = false
  }

  /**
   * Скопировать текст заметки в буфер обмена.
   *
   * @param body текст заметки
   */
  async function copyBody(body: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(body)
    } catch {
      toast?.add({ severity: 'warn', summary: 'Не скопировано', detail: 'Браузер запретил доступ к буферу', life: 3000 })
      return
    }
    toast?.add({ severity: 'success', summary: 'Скопировано', detail: 'Текст в буфере обмена', life: 2000 })
  }

  /**
   * Удалить заметку после подтверждения.
   *
   * @param id id заметки
   */
  function askDelete(id: number): void {
    const run = () => void actions.removeNote(id)
    if (!confirm) {
      run()
      return
    }
    confirm.require({
      header: 'Убрать заметку?',
      message: 'Заметка будет удалена навсегда. Это нельзя отменить.',
      icon: 'pi pi-trash',
      acceptLabel: 'Удалить',
      rejectLabel: 'Отмена',
      accept: run,
    })
  }

  /**
   * Очистить всё избранное после подтверждения.
   */
  function askClearAll(): void {
    if (state.notes.value.length === 0) return
    const run = () => void actions.clearAll()
    if (!confirm) {
      run()
      return
    }
    confirm.require({
      header: 'Очистить избранное?',
      message: `Будет удалено заметок: ${state.total.value}. Это нельзя отменить.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Очистить всё',
      rejectLabel: 'Отмена',
      accept: run,
    })
  }

  /**
   * Переключить режим хранения без тостов (пустые — игнор, см. фикс 422).
   *
   * @param mode server|local
   */
  async function onStorage(mode: 'server' | 'local' | null | undefined): Promise<void> {
    if (mode !== 'server' && mode !== 'local') return
    if (mode === state.storage.value) return
    const ok = await actions.setStorage(mode)
    if (!ok) {
      toast?.add({ severity: 'error', summary: 'Не сохранено', detail: 'Не получилось переключить хранилище', life: 3500 })
    }
  }

  /**
   * Ключ дня для разделителей даты в ленте.
   *
   * @param value дата создания
   */
  function dayKey(value: any): string {
    try {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return ''
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    } catch {
      return ''
    }
  }

  /**
   * Нужен ли разделитель даты над сообщением.
   *
   * @param list лента в хронологическом порядке
   * @param index позиция
   */
  function showDayDivider(list: any[], index: number): boolean {
    if (index === 0) return true
    return dayKey(list[index]?.created_at) !== dayKey(list[index - 1]?.created_at)
  }

  /**
   * Подпись разделителя даты: Сегодня / Вчера / дата.
   *
   * @param value дата создания
   */
  function dayLabel(value: any): string {
    try {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return ''
      const now = new Date()
      const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
      const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
      if (diffDays <= 0) return 'Сегодня'
      if (diffDays === 1) return 'Вчера'
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    } catch {
      return ''
    }
  }

  /**
   * Время сообщения для пузырька.
   *
   * @param value дата создания
   */
  function messageTime(value: any): string {
    try {
      return formatTime(String(value ?? ''))
    } catch {
      return ''
    }
  }

  onMounted(() => {
    void actions.init().then(() => scrollToBottom())
  })

  onBeforeUnmount(() => {
    if (queryTimer) clearTimeout(queryTimer)
    clearPreview()
  })

  return {
    state,
    localHint,
    messages,
    ordered,
    draft,
    file,
    previewUrl,
    attachError,
    editingId,
    editingBody,
    editingRemoveFile,
    showSearch,
    query,
    canSend,
    bindList,
    scrollToBottom,
    pickFile,
    clearPreview,
    onPasteImage,
    send,
    startEdit,
    saveEdit,
    cancelEdit,
    copyBody,
    askDelete,
    askClearAll,
    onStorage,
    showDayDivider,
    dayLabel,
    messageTime,
    handleEnterToSend,
    setSearch: (q: string) => {
      query.value = q
      if (queryTimer) clearTimeout(queryTimer)
      queryTimer = setTimeout(() => void actions.setSearch(q), 350)
    },
    loadMore: () => actions.loadMore(),
  }
}
