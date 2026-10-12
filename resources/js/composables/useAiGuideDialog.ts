import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useAiAssistant } from '@/composables/useAiAssistant'
import { renderAiMarkdown } from '@/composables/useAiMarkdown'

/** Символов за тик печатной машинки (~300 символов в секунду). */
const TYPE_STEP = 6

/** Пауза между тиками печатной машинки, мс. */
const TYPE_INTERVAL = 18

/** Держим автоскролл, если до низа меньше этого, px. */
const SCROLL_FOLLOW_PX = 120

/**
 * Подсказка-чип для пустого диалога с гидом.
 */
export interface AiSuggestion {
  icon: string
  text: string
  question: string
}

/**
 * Запасные чипы, если бэкенд недоступен: только базовый ULove.
 */
const FALLBACK_SUGGESTIONS: AiSuggestion[] = [
  { icon: 'pi pi-heart', text: 'Свайпы', question: 'Как работают свайпы?' },
  { icon: 'pi pi-star', text: 'Мэтч и чат', question: 'Что такое мэтч и как написать человеку?' },
]

/**
 * UI-логика чата с AI-гидом: черновик, отправка, чипы-подсказки,
 * автопрокрутка истории, копирование ответов, форматирование времени.
 *
 * Сеть и история живут в `useAiAssistant` (Pinia), здесь только
 * состояние поля ввода и поведение шаблона.
 *
 * @returns состояние чата и экшены для шаблона
 * @example
 * const { draft, suggestions, historyEl, submitQuestion } = useAiGuideDialog()
 */
export function useAiGuideDialog() {
  const assistant = useAiAssistant()
  const { copy } = useClipboard()

  const draft = ref('')
  const historyEl = ref<HTMLElement | null>(null)
  const copiedIndex = ref(-1)

  /**
   * Чипы быстрых команд с бэка (под модули пользователя),
   * запасные — пока команды грузятся или бэкенд недоступен.
   */
  const suggestions = computed<AiSuggestion[]>(() => {
    const remote = assistant.quickCommands.value

    if (remote.length > 0) {
      return remote.map((cmd) => ({ icon: cmd.icon, text: cmd.label, question: cmd.question }))
    }

    return FALLBACK_SUGGESTIONS
  })

  /** Индекс ответа, который сейчас печатается, -1 когда простоя. */
  const typingIndex = ref(-1)

  /** Сколько символов ответа уже показано. */
  const typingLen = ref(0)

  /** Сколько первых сообщений показаны полностью (защита от повтора). */
  const doneUpTo = ref(0)

  let typeTimer: ReturnType<typeof setInterval> | null = null
  let copiedTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Мотает историю в конец после новых сообщений и старта печати.
   */
  async function scrollHistory(): Promise<void> {
    await nextTick()

    const el = historyEl.value

    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }

  /**
   * Останавливает печатную машинку и гасит курсор.
   */
  function stopTyping(): void {
    if (typeTimer) {
      clearInterval(typeTimer)
      typeTimer = null
    }

    typingIndex.value = -1
  }

  /**
   * Подтягивает скролл за печатью, только если юзер и так внизу:
   * читающего середину истории не дёргаем.
   */
  function followScroll(): void {
    const el = historyEl.value

    if (!el) {
      return
    }

    const gap = el.scrollHeight - el.scrollTop - el.clientHeight

    if (gap < SCROLL_FOLLOW_PX) {
      el.scrollTop = el.scrollHeight
    }
  }

  /**
   * Печатает ответ посимвольно чанками: видно, как текст «пишется».
   * @param index индекс сообщения-ответа в истории
   */
  function startTyping(index: number): void {
    stopTyping()
    typingIndex.value = index
    typingLen.value = 0

    typeTimer = setInterval(() => {
      const msg = assistant.guideMessages.value[index]

      if (!msg) {
        stopTyping()
        return
      }

      typingLen.value = Math.min(msg.text.length, typingLen.value + TYPE_STEP)
      followScroll()

      if (typingLen.value >= msg.text.length) {
        stopTyping()
        doneUpTo.value = assistant.guideMessages.value.length
      }
    }, TYPE_INTERVAL)
  }

  onBeforeUnmount(stopTyping)

  watch(
    () => [assistant.guideMessages.value.length, assistant.guideLoading.value] as const,
    ([len]) => {
      if (len < doneUpTo.value) {
        doneUpTo.value = 0
        stopTyping()
      }

      // Массовая подгрузка (кэш/сервер при restoreGuide) — показываем
      // сразу всё, печатаем только свежие одиночные ответы.
      if (len - doneUpTo.value > 1) {
        doneUpTo.value = len
        stopTyping()
        scrollHistory()
        return
      }

      const msgs = assistant.guideMessages.value
      const last = msgs[msgs.length - 1]

      if (last && last.role === 'assistant' && len > doneUpTo.value && typingIndex.value !== len - 1) {
        scrollHistory()
        startTyping(len - 1)
        return
      }

      if (!last || last.role === 'user') {
        stopTyping()
        doneUpTo.value = len
      }

      scrollHistory()
    },
  )

  /**
   * Пометить всю текущую историю показанной: гасит перепечатку
   * после восстановления диалога с сервера.
   */
  function markHistoryShown(): void {
    stopTyping()
    doneUpTo.value = assistant.guideMessages.value.length
  }

  /**
   * Отправляет вопрос гиду и чистит поле ввода.
   */
  async function submitQuestion(): Promise<void> {
    const text = draft.value.trim()

    if (text === '') {
      return
    }

    draft.value = ''
    await assistant.sendQuestion(text)
  }

  /**
   * Отправляет чип-подсказку как готовый вопрос.
   * @param question текст вопроса из чипа
   */
  async function sendSuggestion(question: string): Promise<void> {
    draft.value = ''
    await assistant.sendQuestion(question)
  }

  /**
   * Копирует текст сообщения и подсвечивает иконку.
   * @param text текст для буфера
   * @param index индекс сообщения для галочки
   */
  async function copyText(text: string, index: number): Promise<void> {
    try {
      await copy(text)
    } catch {
      return
    }

    copiedIndex.value = index

    if (copiedTimer) {
      clearTimeout(copiedTimer)
    }

    copiedTimer = setTimeout(() => {
      copiedIndex.value = -1
    }, 1600)
  }

  /**
   * Видимая часть сообщения: у печатающегося — срез, у остальных — всё.
   * @param text полный текст
   * @param index индекс сообщения
   * @returns текст для рендера
   */
  function visibleText(text: string, index: number): string {
    if (index === typingIndex.value) {
      return text.slice(0, typingLen.value)
    }

    return text
  }

  /**
   * Ответ в красивом HTML: markdown + мигающий курсор во время печати.
   * @param text полный текст ответа
   * @param index индекс сообщения
   * @returns безопасный HTML для v-html
   */
  function renderedText(text: string, index: number): string {
    const html = renderAiMarkdown(visibleText(text, index))

    if (index === typingIndex.value) {
      return `${html}<span class="ai-caret" aria-hidden="true"></span>`
    }

    return html
  }

  /**
   * Короткое время под пузырём сообщения.
   * @param iso ISO-дата из сообщения
   * @returns «14:32» или пусто без даты
   */
  function formatTime(iso?: string | null): string {
    if (!iso) {
      return ''
    }

    const date = new Date(iso)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${hours}:${minutes}`
  }

  return {
    draft,
    historyEl,
    copiedIndex,
    typingIndex,
    suggestions,
    submitQuestion,
    markHistoryShown,
    sendSuggestion,
    copyText,
    formatTime,
    scrollHistory,
    renderedText,
  }
}
