import { computed, onMounted, reactive, readonly } from 'vue'
import { api } from '@/services/api'

/**
 * Реактивный статус интернет-соединения с реальной проверкой сети.
 *
 * `navigator.onLine` врёт: Wi-Fi может словить роутер, но не запускать
 * интернет, а события `online`/`offline` не всегда доходят на мобиле.
 * Поэтому здесь три источника:
 * 1) события окна `online` / `offline` — мгновенная реакция;
 * 2) пробник сети `GET /api/version` (без кэша и в обход SW runtime-кэша);
 * 3) ретрай-цикл каждые 5 с, пока сеть подтверждённо не вернётся.
 *
 * Переход в онлайн объявляем только после успешного пробника: тост
 * «Соединение восстановлено» не всплывает, если Wi-Fi перевключили,
 * но интернета нет. Пока офлайн — дёргаем пробник сами, чтобы тост
 * «ошибка соединения» сменился «восстановлено» даже без события `online`.
 *
 * Детерминированный старт для SSR: сервер и первая гидратация всегда
 * видят `isOnline === true`. Реальное значение подтягивается в
 * `onMounted`, поэтому mismatch нет.
 *
 * @returns isOnline / isOffline / wasOffline флаги, probing, init
 * @example
 * ```ts
 * const { isOffline } = useNetworkStatus()
 * // isOffline.value === true — интернет реально недоступен
 * ```
 */
type NetworkStatusState = {
  /** Текущий статус сети (true — соединение подтверждено пробником). */
  isOnline: boolean
  /** Был ли офлайн хотя бы раз за сессию (нужен для тоста «восстановлено»). */
  wasOffline: boolean
  /** Идёт ли прямо сейчас проба сети. */
  probing: boolean
}

/**
 * Ретрай пробника, пока сеть не подтвердится (посреди офлайна).
 */
const OFFLINE_PROBE_INTERVAL_MS = 5000

/**
 * Фоновый пробник при онлайне: ловит «тихую» смерть Wi-Fi, когда
 * событие `offline` не дошло (частая история на Windows-ноутбуках —
 * адаптер повис, `navigator.onLine` продолжает говорить true).
 */
const ONLINE_PROBE_INTERVAL_MS = 20000

/**
 * Максимальное ожидание ответа пробника (медленный 3G — не отсутствие сети).
 */
const PROBE_TIMEOUT_MS = 6000

const state = reactive<NetworkStatusState>({
  isOnline: true,
  wasOffline: false,
  probing: false,
})

let inited = false
let offlineTimer: ReturnType<typeof setInterval> | null = null
let keepaliveTimer: ReturnType<typeof setInterval> | null = null

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
 * Реальная проба сети: живой ли интернет до нашего сервера.
 *
 * `GET /api/version` исключён из runtime-кэша SW (vite.config),
 * поэтому ответ приходит только из сети — кэш не подделает результат.
 * Любой HTTP-ответ (даже 4xx) означает «интернет есть»; выброс/таймаут — «нет».
 *
 * @returns true если сервер ответил
 */
async function probeNetwork(): Promise<boolean> {
  state.probing = true

  try {
    await api.get('/api/version', {
      params: { t: Date.now() },
      timeout: PROBE_TIMEOUT_MS,
      headers: { 'Cache-Control': 'no-cache' },
    })

    return true
  } catch {
    return false
  } finally {
    state.probing = false
  }
}

/**
 * Обработчик события `offline`: соединение пропало — доверяем сразу.
 */
function handleOffline(): void {
  logTransition('соединение потеряно')
  state.isOnline = false
  state.wasOffline = true
  startOfflineProbing()
}

/**
 * Обработчик события `online`: Wi-Fi поднялся, но интернет может
 * не ходить. Показываем «восстановлено» только после пробника.
 */
async function handleOnline(): Promise<void> {
  const reachable = await probeNetwork()

  if (!reachable) {
    // Роутер есть, интернета нет — тост не убираем, ждём ретрай.
    startOfflineProbing()
    return
  }

  logTransition('соединение восстановлено')
  state.isOnline = true
  stopOfflineProbing()
}

/**
 * Остановить ретрай-цикл офлайна.
 */
function stopOfflineProbing(): void {
  if (offlineTimer === null) {
    return
  }

  clearInterval(offlineTimer)
  offlineTimer = null
}

/**
 * Запустить ретрай-цикл: пробуем сеть каждые 5 с, пока офлайн.
 *
 * Каждый успешный пробник подтверждает восстановление соединения без
 * события `online` (Wi-Fi уже ловит, но событие не пришло).
 */
function startOfflineProbing(): void {
  if (offlineTimer !== null || typeof window === 'undefined') {
    return
  }

  offlineTimer = setInterval(async () => {
    const reachable = await probeNetwork()

    if (reachable) {
      logTransition('соединение восстановлено (фоновый пробник)')
      state.isOnline = true
      stopOfflineProbing()
    }
  }, OFFLINE_PROBE_INTERVAL_MS)
}

/**
 * Остановить фоновый пробник онлайна.
 */
function stopKeepaliveProbing(): void {
  if (keepaliveTimer === null) {
    return
  }

  clearInterval(keepaliveTimer)
  keepaliveTimer = null
}

/**
 * Фоновый пробник при онлайне: раз в 20 с (только в видимой вкладке)
 * проверять, жив ли интернет. Ловит «тихий» обрыв, когда событие
 * `offline` не дошло — тост о потере соединения всё равно покажется.
 */
function startKeepaliveProbing(): void {
  if (keepaliveTimer !== null || typeof window === 'undefined') {
    return
  }

  keepaliveTimer = setInterval(async () => {
    if (document.hidden) {
      return
    }

    const reachable = await probeNetwork()

    if (reachable) {
      state.isOnline = true
      stopOfflineProbing()
      return
    }

    logTransition('соединение потеряно (фоновый пробник)')
    state.isOnline = false
    state.wasOffline = true
    startOfflineProbing()
  }, ONLINE_PROBE_INTERVAL_MS)
}

/** Лог переходов: видно в консоли, обновился ли код трекера. */
function logTransition(message: string): void {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return
  }

  console.info(`[network] ${message}`)
}

/**
 * Подписаться на события сети (один раз за жизнь страницы).
 */
function bindListeners(): void {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

/**
 * Инициализировать трекинг сети: события окна + стартовые пробники.
 *
 * Идемпотентна: повторные вызовы (несколько лейаутов/компонентов) —
 * no-op. Отписка не нужна: слушатели и таймеры живут всю страницу,
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
    startOfflineProbing()
  }

  bindListeners()
  startKeepaliveProbing()

  // `navigator.onLine` может говорить «онлайн» на мёртвом Wi-Fi —
  // первая же проба приводит этот статус к правде.
  void probeNetwork().then((reachable) => {
    if (!reachable) {
      logTransition('соединение потеряно (стартовая проба)')
      state.isOnline = false
      state.wasOffline = true
      startOfflineProbing()
    }
  })
}

/**
 * Реактивный статус сети: singleton-состояние читают все вызовы хука.
 *
 * @returns флаги isOnline/isOffline/wasOffline/probing и init
 */
export function useNetworkStatus() {
  const isOnline = computed(() => state.isOnline)
  const isOffline = computed(() => state.isOnline === false)
  const wasOffline = computed(() => state.wasOffline)
  const probing = computed(() => state.probing)

  onMounted(() => initNetworkStatus())

  return {
    state: readonly(state),
    isOnline,
    isOffline,
    wasOffline,
    probing,
    init: initNetworkStatus,
  }
}
