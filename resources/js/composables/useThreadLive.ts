import { watch } from 'vue'
import { busEmit, busOn, registerPollContextProvider } from '@/services/realtime-bus'

/**
 * Вид треда комментариев.
 */
export type ThreadKind = 'pin' | 'flow' | 'district' | 'photo'

/** Пауза против двойного рефетча (сокет + тик поллинга рядом). */
const REFETCH_DEBOUNCE_MS = 800

/** Ключ подписки вид:id. */
function threadKey(kind: string, id: number): string {
  return `${kind}:${id}`
}

type WatchEntry = {
  kind: ThreadKind
  id: number
  knownMax: () => number
}

const watches = new Map<string, WatchEntry>()
const callbacks = new Map<string, Set<() => void>>()
const echoChannels = new Map<string, any>()
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
let busBound = false
let pollBound = false

/**
 * Разнести событие треда подписчикам (сокет и поллинг — один формат).
 *
 * @param kind вид треда
 * @param id id объекта
 */
function emitThread(kind: string, id: number): void {
  const set = callbacks.get(threadKey(kind, id))
  if (!set) return
  set.forEach((cb) => {
    try {
      cb()
    } catch {}
  })
}

function ensureBus(): void {
  if (busBound) return
  busBound = true
  busOn('thread:updated', (e) => {
    if (!e?.kind || e?.id == null) return
    emitThread(String(e.kind), Number(e.id))
  })
}

function ensurePoll(): void {
  if (pollBound) return
  pollBound = true
  try {
    registerPollContextProvider('thread', () => {
      if (!watches.size) return {}
      const parts: string[] = []
      watches.forEach((w) => {
        let known = 0
        try {
          known = Math.max(0, Number(w.knownMax()) || 0)
        } catch {}
        parts.push(`${w.kind}:${w.id}:${known}`)
      })
      return parts.length ? { watchThreads: parts.slice(0, 5).join(',') } : {}
    })
  } catch {}
}

/**
 * Живой тред комментариев: сокет-канал объекта + добивка поллингом.
 *
 * Сигнал (сокет `thread.updated` или `watch_threads` из sync) лишь пинает
 * колбэк — свежие данные хук всегда тянет обычным REST (там проверки
 * видимости), поэтому оба транспорта дают одинаковый результат.
 * Пейлоад события специально без содержимого — приватность intact.
 *
 * @param opts kind/id геттеры, knownMax — макс. известный id, onChanged — рефетч
 * @returns функция отписки (канал + реестр + дебаунс)
 *
 * @example
 * const off = bindThreadLive({
 *   kind: 'flow', id: () => postId, knownMax: () => maxCommentId.value,
 *   onChanged: () => load(), isOpen: () => expanded.value,
 * })
 * onBeforeUnmount(off)
 */
export function bindThreadLive(opts: {
  kind: ThreadKind
  id: () => number | null
  knownMax: () => number
  onChanged: () => void
  isOpen?: () => boolean
  isBusy?: () => boolean
}): () => void {
  ensureBus()
  ensurePoll()

  let currentKey: string | null = null
  let off: (() => void) | null = null

  function fire(): void {
    try {
      if (opts.isOpen && !opts.isOpen()) return
      if (opts.isBusy && opts.isBusy()) return
    } catch {
      return
    }
    const activeKey = currentKey
    if (!activeKey) return
    const prev = debounceTimers.get(activeKey)
    if (prev) clearTimeout(prev)
    debounceTimers.set(
      activeKey,
      setTimeout(() => {
        try {
          if (opts.isOpen && !opts.isOpen()) return
          if (opts.isBusy && opts.isBusy()) return
          opts.onChanged()
        } catch {}
      }, REFETCH_DEBOUNCE_MS),
    )
  }

  function detach(): void {
    if (off) {
      try {
        off()
      } catch {}
      off = null
    }
    if (currentKey) {
      watches.delete(currentKey)
      const [kind, id] = currentKey.split(':')
      try {
        ;(window as any).Echo?.leave(`threads.${kind}.${id}`)
      } catch {}
      echoChannels.delete(currentKey)
      const timer = debounceTimers.get(currentKey)
      if (timer) clearTimeout(timer)
      debounceTimers.delete(currentKey)
      currentKey = null
    }
  }

  function attach(): void {
    detach()
    const id = Number(opts.id() ?? 0)
    if (!opts.kind || !id) return
    const activeKey = threadKey(opts.kind, id)
    currentKey = activeKey
    watches.set(activeKey, { kind: opts.kind, id, knownMax: opts.knownMax })
    let set = callbacks.get(activeKey)
    if (!set) {
      set = new Set()
      callbacks.set(activeKey, set)
    }
    const cb = () => fire()
    set.add(cb)
    off = () => {
      try {
        callbacks.get(activeKey)?.delete(cb)
      } catch {}
    }
    try {
      const echo = (window as any).Echo
      if (echo) {
        const channel = echo.channel(`threads.${opts.kind}.${id}`)
        channel.listen('.thread.updated', (e: any) => {
          try {
            busEmit('thread:updated', {
              kind: String(e?.kind ?? opts.kind),
              id: Number(e?.id ?? id),
              lastId: 0,
            })
          } catch {}
        })
        echoChannels.set(activeKey, channel)
      }
    } catch {}
  }

  const stopWatch = watch([() => opts.kind, () => opts.id()], () => attach(), { immediate: true })

  return () => {
    try {
      stopWatch()
    } catch {}
    detach()
  }
}
