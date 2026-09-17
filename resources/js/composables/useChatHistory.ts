import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { Message } from '@/types/entities/Chat'

const MAX_KEEP = 400

export interface ChatHistoryLoader {
  /**
   * Грузит страницу истории старше beforeId (исключая его).
   *
   * @param beforeId id самого старого загруженного сообщения
   * @returns сообщения от старых к новым + флаг есть ли ещё
   */
  loadPage: (beforeId: number) => Promise<Message[] | { data: Message[]; has_more: boolean }>
  /** Ключ текущего диалога; если сменился во время запроса — результат отбрасывается. */
  getKey: () => number | null
}

/**
 * История чата с бесконечной подгрузкой вверх.
 *
 * Верхний sentinel (`topSentinel`) через IntersectionObserver тихо догружает
 * старые страницы (`before=id`), сохраняя позицию скролла. Когда сервер
 * отдал `has_more=false` или пустую страницу — `hasMore=false` и стоп.
 * Новое сообщение внизу — всегда докат, если пользователь был внизу.
 *
 * @param source живой список сообщений диалога (старые первые)
 * @param loader загрузчик страниц + ключ диалога
 * @example
 * const history = useChatHistory(messages, { loadPage: (b) => chatApi.messages(id, b), getKey: () => id })
 * // <div ref="history.topSentinel" />
 */
export function useChatHistory(source: Ref<Message[]>, loader: ChatHistoryLoader) {
  const loadingOlder = ref(false)
  const hasMore = ref(true)
  const topSentinel = ref<HTMLElement | null>(null)

  let observer: IntersectionObserver | null = null
  let currentKey: number | null = null

  function containerEl(): HTMLElement | null {
    return document.getElementById('chat-messages')
  }

  /**
   * Докат истории вниз.
   */
  function scrollToBottom(): void {
    requestAnimationFrame(() => {
      nextTick(() => {
        const el = containerEl()
        if (el) el.scrollTop = el.scrollHeight
      })
    })
  }

  /**
   * Сброс при смене диалога: новый ключ, есть ещё история, докат вниз.
   */
  function reset(): void {
    currentKey = loader.getKey()
    hasMore.value = true
    loadingOlder.value = false
    scrollToBottom()
  }

  /**
   * Умный докат: только если пользователь уже внизу (<=120px до низа),
   * иначе не дёргаем чтение чужой переписки.
   */
  function notifyAppended(): void {
    try {
      const el = containerEl()
      if (!el) {
        scrollToBottom()
        return
      }
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140
      if (nearBottom) scrollToBottom()
    } catch {
      scrollToBottom()
    }
  }

  /**
   * Нормализовать ответ лоадера к {rows, hasMore}.
   *
   * @param raw ответ chatApi.messages
   */
  function normalize(raw: Message[] | { data: Message[]; has_more: boolean }): { rows: Message[]; more: boolean | null } {
    if (Array.isArray(raw)) return { rows: raw, more: raw.length > 0 ? null : false }
    return { rows: Array.isArray(raw.data) ? raw.data : [], more: !!raw.has_more }
  }

  /**
   * Тихо догрузить страницу старше текущей, сохранив скролл.
   *
   * @returns true если что-то добавлено
   */
  async function loadOlder(): Promise<boolean> {
    if (loadingOlder.value || !hasMore.value) return false
    const key = loader.getKey()
    if (!key) return false
    const first = source.value.find((m) => Number(m?.id) > 0)
    if (!first?.id) return false
    loadingOlder.value = true
    const el = containerEl()
    const prevH = el?.scrollHeight ?? 0
    const prevTop = el?.scrollTop ?? 0
    try {
      const raw = await loader.loadPage(Number(first.id))
      if (loader.getKey() !== key) return false
      const { rows, more } = normalize(raw)
      if (more !== null) hasMore.value = more
      if (!rows.length) {
        if (more === null) hasMore.value = false
        return false
      }
      const known = new Set(source.value.map((m) => Number(m?.id)))
      const fresh = rows.filter((m) => m?.id != null && !known.has(Number(m.id)))
      fresh.sort((a: Message, b: Message) => Number(a.id) - Number(b.id))
      if (more === null && rows.length === 0) hasMore.value = false
      if (!fresh.length) {
        // Дубли — но сервер сказал есть ещё, пробуем дальше; если hasMore не пришёл — стоп
        if (more === null) hasMore.value = false
        return false
      }
      const merged = [...fresh, ...source.value] as Message[]
      source.value = (merged.length > MAX_KEEP ? merged.slice(merged.length - MAX_KEEP) : merged) as Message[]
      if (merged.length > MAX_KEEP) hasMore.value = true
      await nextTick()
      if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH)
      return true
    } catch {
      return false
    } finally {
      loadingOlder.value = false
    }
  }

  /**
   * Скроллит к сообщению, тихо догружая историю вверх при нужде.
   *
   * @param id id сообщения
   * @returns true если найдено и показано
   */
  async function scrollToMessage(id: number): Promise<boolean> {
    const target = Number(id)
    if (!target) return false
    let guard = 0
    let idx = source.value.findIndex((m) => Number(m?.id) === target)
    while (idx === -1 && guard < 8) {
      const ok = await loadOlder()
      if (!ok) break
      idx = source.value.findIndex((m) => Number(m?.id) === target)
      guard += 1
    }
    if (idx === -1) return false
    await nextTick()
    document.getElementById(`msg-${target}`)?.scrollIntoView({ block: 'center' })
    return true
  }

  function ensureObserver(): void {
    try {
      if (observer || typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver(
        (entries) => {
          const hit = entries.some((e) => e.isIntersecting)
          if (hit) void loadOlder()
        },
        { root: containerEl(), rootMargin: '400px 0px 0px 0px', threshold: 0 },
      )
      if (topSentinel.value) observer.observe(topSentinel.value)
    } catch {
      /* noop */
    }
  }

  function stopObserver(): void {
    try {
      observer?.disconnect()
    } catch {
      /* noop */
    }
    observer = null
  }

  // Переподписка sentinel при смене DOM-узла
  watch(topSentinel, (el, _, onCleanup) => {
    try {
      if (!observer) ensureObserver()
      if (el && observer) observer.observe(el)
      onCleanup(() => {
        try {
          if (el && observer) observer.unobserve(el)
        } catch {
          /* noop */
        }
      })
    } catch {
      /* noop */
    }
  })

  onMounted(() => ensureObserver())

  onBeforeUnmount(() => {
    stopObserver()
  })

  return {
    loadOlder,
    reset,
    scrollToBottom,
    scrollToMessage,
    notifyAppended,
    loadingOlder,
    hasMore,
    topSentinel,
    ensureObserver,
  }
}
