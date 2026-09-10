import { nextTick, ref, type Ref } from 'vue'
import { chatApi } from '@/services/chat.api'
import type { Message } from '@/types/entities/Chat'

export function usePinnedMessages(messages: Ref<Message[]>) {
  const pinned = ref<Message[]>([])
  const pinLimit = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const flashId = ref<number | null>(null)
  const convId = ref<number | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  let channel: any = null

  function syncFlags() {
    const ids = new Set(pinned.value.map((m) => m.id))
    messages.value.forEach((m: any) => {
      m.is_pinned = ids.has(m.id)
    })
  }

  function leaveChannel() {
    try {
      const echo = (window as any).Echo
      if (echo && convId.value) echo.leave(`chat.${convId.value}`)
    } catch { /* noop */ }
    channel = null
  }

  function subscribe(id: number) {
    try {
      const echo = (window as any).Echo
      if (!echo) return
      channel = echo.private(`chat.${id}`)
      channel.listen('.message.pinned', (e: any) => {
        if (e?.message) applyRemote(e.message as Message)
      })
    } catch { /* noop */ }
  }

  function applyRemote(msg: Message) {
    const i = messages.value.findIndex((m) => m.id === msg.id)
    if (i !== -1) messages.value[i] = { ...messages.value[i], ...msg }
    const p = pinned.value.findIndex((m) => m.id === msg.id)
    if (msg.is_pinned) {
      if (p === -1) pinned.value = [...pinned.value, msg]
      else pinned.value[p] = msg
    } else if (p !== -1) {
      pinned.value = pinned.value.filter((m) => m.id !== msg.id)
    }
    syncFlags()
  }

  async function load(id: number, initial?: { pinned?: Message[]; pin_limit?: number | null }) {
    if (convId.value !== null && convId.value !== id) leaveChannel()
    convId.value = id
    error.value = null
    if (initial?.pinned) {
      pinned.value = initial.pinned
      pinLimit.value = initial.pin_limit ?? null
      syncFlags()
      subscribe(id)
      return
    }
    loading.value = true
    try {
      const res = await chatApi.pinnedMessages(id)
      if (convId.value !== id) return
      pinned.value = res.pinned
      pinLimit.value = res.pin_limit
      syncFlags()
      subscribe(id)
    } catch (e: any) {
      error.value = e?.response?.status === 429
        ? 'Слишком частые запросы. Подождите немного и попробуйте снова.'
        : e?.response?.data?.message || 'Не удалось загрузить закрепы'
    } finally {
      loading.value = false
    }
  }

  function reset() {
    leaveChannel()
    convId.value = null
    pinned.value = []
    pinLimit.value = null
    error.value = null
    flashId.value = null
  }

  async function toggle(msg: Message): Promise<boolean> {
    error.value = null
    try {
      const updated = msg.is_pinned
        ? await chatApi.unpinMessage(msg.id)
        : await chatApi.pinMessage(msg.id)
      applyRemote(updated)
      return true
    } catch (e: any) {
      error.value = e?.response?.status === 429
        ? 'Слишком частые запросы. Подождите немного и попробуйте снова.'
        : e?.response?.data?.message || 'Не удалось закрепить сообщение'
      return false
    }
  }

  async function unpin(id: number): Promise<boolean> {
    const msg = pinned.value.find((m) => m.id === id) ?? messages.value.find((m) => m.id === id)
    if (!msg) return false
    return toggle(msg)
  }

  /**
   * Плавно скроллит к сообщению и подсвечивает его.
   * Если сообщения нет на экране — догружает историю выше.
   * @param id id сообщения
   */
  async function jumpTo(id: number) {
    let el = document.getElementById(`msg-${id}`)
    let guard = 0
    while (!el && guard < 5 && convId.value) {
      const first = messages.value[0] as any
      if (!first) break
      let older: Message[] = []
      try {
        older = await chatApi.messages(convId.value, first.id)
      } catch {
        break
      }
      if (!older.length) break
      const box = document.getElementById('chat-messages')
      const prevH = box?.scrollHeight ?? 0
      const prevTop = box?.scrollTop ?? 0
      messages.value = [...older, ...messages.value] as Message[]
      await nextTick()
      if (box) box.scrollTop = prevTop + (box.scrollHeight - prevH)
      el = document.getElementById(`msg-${id}`)
      guard++
    }
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    flashId.value = id
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { flashId.value = null }, 1600)
  }

  function limitLabel(): string {
    return pinLimit.value === null || pinLimit.value === undefined ? '∞' : String(pinLimit.value)
  }

  return { pinned, pinLimit, loading, error, flashId, load, reset, toggle, unpin, jumpTo, limitLabel, applyRemote }
}
