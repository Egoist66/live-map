import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'
import { useVirtualList } from '@vueuse/core'
import type { Message } from '@/types/entities/Chat'

const ESTIMATE_PX = 76
const NEAR_TOP_PX = 520
const NEAR_BOTTOM_PX = 160

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
 * Виртуализированная история чата на VueUse `useVirtualList`.
 * Начальная порция + догрузка вверх по скроллу, замер реальных высот,
 * сохранение позиции при prepend, автодокат только когда юзер внизу.
 *
 * @param source живой список сообщений диалога (старые первые)
 * @param loader загрузчик страниц + ключ диалога
 * @param pageSize размер страницы бэка (для флага hasMore)
 *
 * @example
 * const history = useChatHistory(messages, {
 *   loadPage: (before) => chatApi.messages(selectedId.value!, before),
 *   getKey: () => selectedId.value,
 * })
 */
export function useChatHistory(source: Ref<Message[]>, loader: ChatHistoryLoader, pageSize = 30) {
  const hasMore = ref(true)
  const loadingOlder = ref(false)
  const stickToBottom = ref(true)
  const unseenCount = ref(0)
  const heightById = new Map<number, number>()
  const observed = new Set<number>()
  let ro: ResizeObserver | null = null
  let scrollEl: HTMLElement | null = null

  /**
   * Высота строки: замеренная по id сообщения или оценка.
   * @param index индекс в source
   * @returns высота в px
   */
  function heightFor(index: number): number {
    const id = Number(source.value[index]?.id)
    if (!id) return ESTIMATE_PX
    return heightById.get(id) ?? ESTIMATE_PX
  }

  const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(source as any, {
    itemHeight: (index: number) => heightFor(index),
    overscan: 10,
  } as any)

  /**
   * Высота строки для шаблона (фиксирует бокс, меряем внутренность).
   * @param id id сообщения
   * @returns высота в px
   */
  function rowHeight(id: number): number {
    return heightById.get(Number(id)) ?? ESTIMATE_PX
  }

  function containerEl(): HTMLElement | null {
    return document.getElementById('chat-messages')
  }

  /**
   * Меряет отрендеренные строки и кеширует высоты по id сообщения.
   */
  function measureRows(): void {
    const el = scrollEl ?? containerEl()
    if (!el) return
    const nodes = el.querySelectorAll('[data-vm]')
    nodes.forEach((node) => {
      const wrap = node as HTMLElement
      const id = Number(wrap.getAttribute('data-vm'))
      if (!id || observed.has(id)) return
      observed.add(id)
      try {
        if (!ro) {
          ro = new ResizeObserver((entries) => {
            entries.forEach((entry) => {
              const t = entry.target as HTMLElement
              const mid = Number(t.getAttribute('data-vm'))
              if (!mid) return
              const h = Math.ceil(entry.contentRect.height)
              if (h > 0 && heightById.get(mid) !== h) heightById.set(mid, h)
            })
          })
        }
        ro.observe(wrap)
        const h = Math.ceil(wrap.getBoundingClientRect().height)
        if (h > 0 && !heightById.has(id)) heightById.set(id, h)
      } catch { /* noop */ }
    })
    if (observed.size > 800) {
      const alive = new Set(source.value.map((m) => Number(m?.id)))
      observed.forEach((id) => { if (!alive.has(id)) observed.delete(id) })
      heightById.forEach((_, id) => { if (!alive.has(id)) heightById.delete(id) })
    }
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
    nextTick(() => measureRows())
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
    if (!first) return false
    loadingOlder.value = true
    const el = containerEl()
    const prevH = el?.scrollHeight ?? 0
    const prevTop = el?.scrollTop ?? 0
    try {
      const older = await loader.loadPage(Number(first?.id))
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
        source.value = [...fresh, ...source.value] as Message[]
        await nextTick()
        if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH)
        nextTick(() => measureRows())
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
    try {
      scrollTo(idx)
    } catch {
      const el = containerEl()
      if (el) {
        const node = document.getElementById(`msg-${target}`)
        node?.scrollIntoView({ block: 'center' })
      }
    }
    return true
  }

  /**
   * Реакция на новое сообщение: докат если юзер внизу, иначе счётчик.
   * @param own своё ли сообщение
   */
  function notifyAppended(own: boolean): void {
    nextTick(() => measureRows())
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
    nextTick(() => measureRows())
  }

  /**
   * Снимает слушатель скролла и наблюдатель размеров.
   */
  function detach(): void {
    if (scrollEl) scrollEl.removeEventListener('scroll', onScroll)
    scrollEl = null
    try { ro?.disconnect() } catch { /* noop */ }
    ro = null
    observed.clear()
  }

  onBeforeUnmount(() => detach())

  return {
    list,
    containerProps,
    wrapperProps,
    hasMore,
    loadingOlder,
    stickToBottom,
    unseenCount,
    rowHeight,
    loadOlder,
    reset,
    scrollToBottom,
    scrollToMessage,
    notifyAppended,
    attach,
    detach,
    measureRows,
  }
}
