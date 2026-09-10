import { computed, nextTick, onBeforeUnmount, ref, type Ref } from 'vue'
import type { Message } from '@/types/entities/Chat'

const NEAR_TOP_PX = 520
const NEAR_BOTTOM_PX = 160
const MAX_KEEP = 400

export interface ChatHistoryLoader {
  /**
   * Грузит страницу истории старше beforeId (исключая его).
   * @param beforeId id самого старого загруженного сообщения
   * @returns сообщения от старых к новым
   */
  loadPage: (beforeId: number) => Promise<Message[]>
  /** Ключ текущего диалога; если сменился во время запроса — результат отбрасывается. */
  getKey: () => number | null
}

/**
 * История чата: прямой рендер списка, догрузка вверх по скроллу,
 * сохранение позиции при prepend, автодокат только когда юзер внизу.
 *
 * @param source живой список сообщений диалога (старые первые)
 * @param loader загрузчик страниц + ключ диалога
 * @param pageSize размер страницы бэка (для флага hasMore)
 */
export function useChatHistory(source: Ref<Message[]>, loader: ChatHistoryLoader, pageSize = 30) {
  const hasMore = ref(true)
  const loadingOlder = ref(false)
  const stickToBottom = ref(true)
  const unseenCount = ref(0)
  let scrollEl: HTMLElement | null = null

  const list = computed(() => source.value.map((data, index) => ({ data, index })))

  function containerEl(): HTMLElement | null {
    return document.getElementById('chat-messages')
  }

  function scrollToBottom(): void {
    stickToBottom.value = true
    unseenCount.value = 0
    requestAnimationFrame(() => {
      nextTick(() => {
        const el = containerEl()
        if (el) el.scrollTop = el.scrollHeight
      })
    })
  }

  /**
   * Сброс при смене диалога: флаг hasMore, липкость, докат вниз.
   * @param more есть ли старше начальной порции
   */
  function reset(more: boolean): void {
    hasMore.value = more
    loadingOlder.value = false
    unseenCount.value = 0
    stickToBottom.value = true
    scrollToBottom()
  }

  /**
   * Догружает страницу старше текущей и сохраняет позицию скролла.
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
      const older = await loader.loadPage(Number(first.id))
      if (loader.getKey() !== key) return false
      if (!older.length) {
        hasMore.value = false
        return false
      }
      if (older.length < pageSize) hasMore.value = false
      const known = new Set(source.value.map((m) => Number(m?.id)))
      const fresh = older.filter((m) => m?.id != null && !known.has(Number(m.id)))
      fresh.sort((a: any, b: any) => Number(a.id) - Number(b.id))
      if (fresh.length) {
        const merged = [...fresh, ...source.value] as Message[]
        if (merged.length > MAX_KEEP) {
          source.value = merged.slice(merged.length - MAX_KEEP) as Message[]
          hasMore.value = true
        } else {
          source.value = merged as Message[]
        }
        await nextTick()
        if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH)
      }
      return fresh.length > 0
    } catch {
      return false
    } finally {
      loadingOlder.value = false
    }
  }

  /**
   * Скроллит к сообщению, догружая историю вверх при нужде.
   * @param id id сообщения
   * @returns true если найдено и показано
   */
  async function scrollToMessage(id: number): Promise<boolean> {
    const target = Number(id)
    if (!target) return false
    let guard = 0
    let idx = source.value.findIndex((m) => Number(m?.id) === target)
    while (idx === -1 && hasMore.value && guard < 8) {
      const ok = await loadOlder()
      if (!ok) break
      idx = source.value.findIndex((m) => Number(m?.id) === target)
      guard += 1
    }
    if (idx === -1) return false
    stickToBottom.value = false
    await nextTick()
    document.getElementById(`msg-${target}`)?.scrollIntoView({ block: 'center' })
    return true
  }

  /**
   * Реакция на новое сообщение: докат если юзер внизу, иначе счётчик.
   * @param own своё ли сообщение
   */
  function notifyAppended(own: boolean): void {
    if (stickToBottom.value || own) {
      scrollToBottom()
      return
    }
    unseenCount.value += 1
  }

  function onScroll(): void {
    const el = scrollEl
    if (!el) return
    const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.value = distBottom < NEAR_BOTTOM_PX
    if (stickToBottom.value) unseenCount.value = 0
    if (el.scrollTop < NEAR_TOP_PX) void loadOlder()
  }

  /**
   * Вешает слушатель скролла на контейнер истории.
   */
  function attach(): void {
    scrollEl = containerEl()
    if (scrollEl) scrollEl.addEventListener('scroll', onScroll, { passive: true })
  }

  /**
   * Снимает слушатель скролла.
   */
  function detach(): void {
    if (scrollEl) scrollEl.removeEventListener('scroll', onScroll)
    scrollEl = null
  }

  onBeforeUnmount(() => detach())

  return {
    list,
    hasMore,
    loadingOlder,
    stickToBottom,
    unseenCount,
    loadOlder,
    reset,
    scrollToBottom,
    scrollToMessage,
    notifyAppended,
    attach,
    detach,
  }
}
