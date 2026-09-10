import { nextTick, type Ref } from 'vue'
import type { Message } from '@/types/entities/Chat'

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
 * Простая история чата: прямой рендер списка и докат вниз.
 * Старые страницы тихо догружаются только для прыжков к закрепам,
 * никаких верхних лоадеров и автоподгрузок по скроллу.
 *
 * @param source живой список сообщений диалога (старые первые)
 * @param loader загрузчик страниц + ключ диалога
 */
export function useChatHistory(source: Ref<Message[]>, loader: ChatHistoryLoader) {
  let loadingOlder = false

  function containerEl(): HTMLElement | null {
    return document.getElementById('chat-messages')
  }

  /**
   * Докат истории вниз.
   * @returns void
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
   * Сброс при смене диалога: докат вниз.
   * @returns void
   */
  function reset(): void {
    scrollToBottom()
  }

  /**
   * Реакция на новое сообщение: всегда докат вниз.
   * @returns void
   */
  function notifyAppended(): void {
    scrollToBottom()
  }

  /**
   * Тихо догружает страницу старше текущей для прыжка к закрепу.
   * @returns true если что-то добавлено
   */
  async function loadOlder(): Promise<boolean> {
    if (loadingOlder) return false
    const key = loader.getKey()
    if (!key) return false
    const first = source.value.find((m) => Number(m?.id) > 0)
    if (!first?.id) return false
    loadingOlder = true
    const el = containerEl()
    const prevH = el?.scrollHeight ?? 0
    const prevTop = el?.scrollTop ?? 0
    try {
      const older = await loader.loadPage(Number(first.id))
      if (loader.getKey() !== key) return false
      if (!older.length) return false
      const known = new Set(source.value.map((m) => Number(m?.id)))
      const fresh = older.filter((m) => m?.id != null && !known.has(Number(m.id)))
      fresh.sort((a: any, b: any) => Number(a.id) - Number(b.id))
      if (!fresh.length) return false
      const merged = [...fresh, ...source.value] as Message[]
      source.value = (merged.length > MAX_KEEP ? merged.slice(merged.length - MAX_KEEP) : merged) as Message[]
      await nextTick()
      if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH)
      return true
    } catch {
      return false
    } finally {
      loadingOlder = false
    }
  }

  /**
   * Скроллит к сообщению, тихо догружая историю вверх при нужде.
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

  return {
    loadOlder,
    reset,
    scrollToBottom,
    scrollToMessage,
    notifyAppended,
  }
}
