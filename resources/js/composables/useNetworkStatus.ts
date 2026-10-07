import { computed, onMounted, reactive, readonly } from 'vue'

/**
 * Реактивный статус интернет-соединения.
 *
 * Источник данных — `navigator.onLine`, обновления — подписка
 * на события окна `online` / `offline`. Состояние общее (singleton):
 * слушатели вешаются один раз за жизнь страницы, все вызовы хука
 * читают один и тот же реактивный объект.
 *
 * Детерминированный старт для SSR: сервер и первая гидратация всегда
 * видят `isOnline === true`. Реальное значение `navigator.onLine`
 * подтягивается в `onMounted` (после гидратации), поэтому mismatch нет.
 *
 * @returns isOnline / isOffline флаги, wasOffline (был ли офлайн за сессию), init
 * @example
 * ```ts
 * const { isOnline, isOffline } = useNetworkStatus()
 * // isOffline.value === true — пропал интернет
 * ```
 */
type NetworkStatusState = {
  /** Текущий статус сети (true — есть соединение). */
  isOnline: boolean
  /** Был ли офлайн хотя бы раз за сессию (нужен для тоста «восстановлено»). */
  wasOffline: boolean
}

const state = reactive<NetworkStatusState>({
  isOnline: true,
  wasOffline: false,
})

let inited = false

/**
 * Прочитать текущий статус из `navigator.onLine`.
 *
 * @returns false только когда браузер точно сообщает об офлайне
 */
function readNavigatorOnline(): boolean {
  try {
    if (typeof navigator === 'undefined') {
      return true
    }

    return navigator.onLine
  } catch {
    return true
  }
}

/**
 * Обработчик события `online`: соединение появилось.
 */
function handleOnline(): void {
  state.isOnline = true
}

/**
 * Обработчик события `offline`: соединение пропало.
 */
function handleOffline(): void {
  state.isOnline = false
  state.wasOffline = true
}

/**
 * Подписаться на события сети (один раз за жизнь страницы).
 */
function bindListeners(): void {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

/**
 * Инициализировать трекинг сети: считать `navigator.onLine` и подписаться.
 *
 * Идемпотентна: повторные вызовы (несколько лейаутов/компонентов) —
 * no-op. Отписка не нужна: два лёгких слушателя живут всю страницу,
 * как `bindOnce` в `pwa.service`.
 */
export function initNetworkStatus(): void {
  if (inited) {
    return
  }

  inited = true
  state.isOnline = readNavigatorOnline()

  if (typeof window === 'undefined') {
    return
  }

  if (state.isOnline === false) {
    state.wasOffline = true
  }

  bindListeners()
}

export function useNetworkStatus() {
  const isOnline = computed(() => state.isOnline)
  const isOffline = computed(() => state.isOnline === false)
  const wasOffline = computed(() => state.wasOffline)

  onMounted(() => initNetworkStatus())

  return {
    state: readonly(state),
    isOnline,
    isOffline,
    wasOffline,
    init: initNetworkStatus,
  }
}
