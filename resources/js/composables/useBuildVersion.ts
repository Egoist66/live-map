import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { api } from '@/services/api'
import { replaceUrlPreservingState } from '@/composables/useHistoryState'
import { hardRefreshToLatest } from '@/pwa/cache.service'

/**
 * Проверка версии билда и жесткое обновление приложения.
 *
 * После каждого деплоя (push в Laravel Cloud) хэш `public/build/manifest.json`
 * меняется. Хук опрашивает `GET /api/version` и выставляет флаг,
 * по которому баннер показывает кнопку «Обновить».
 *
 * @example
 * const { buildUpdateAvailable, refreshApp, init } = useBuildVersion()
 */

const POLL_INTERVAL_MS = 60 * 1000
const DISMISSED_KEY = 'uconnect-dismissed-build'
const APPLIED_KEY = 'uconnect-applied-build'

const initialVersion = ref<string | null>(null)
const latestVersion = ref<string | null>(null)
const buildUpdateAvailable = ref(false)
const checking = ref(false)
const refreshing = ref(false)

let inited = false
let timer: ReturnType<typeof setInterval> | null = null
let offNavigate: (() => void) | null = null

function readInitialVersion(): string | null {
  try {
    const version = (usePage().props as Record<string, unknown>).appVersion
    return typeof version === 'string' && version !== '' ? version : null
  } catch {
    return null
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  const response = await api.get('/api/version', { params: { t: Date.now() } })
  const version = (response.data as Record<string, unknown>)?.version
  return typeof version === 'string' && version !== '' ? version : null
}

/**
 * Сверить версию билда с сервером.
 *
 * Флаг залипает: раз показанное обновление не гаснет само по себе.
 * Во время rolling-деплоя инстансы отдают разные версии и опросы
 * флиппуют mismatch — без latch баннер появляется и мгновенно
 * пропадает. Снимается только руками: `refreshApp`/`dismissBuildUpdate`.
 *
 * Анти-луп: версия, до которой пользователь уже обновился кнопкой
 * (`APPLIED_KEY`), баннер больше не поднимает — даже если после
 * перезагрузки сервер/кэш всё ещё отдают старый `appVersion`
 * (stale HTML, rolling-инстанс). Один деплой — один баннер.
 *
 * @returns true когда обновление доступно (включая залипшее)
 */
export async function checkForBuildUpdate(): Promise<boolean> {
  if (buildUpdateAvailable.value) {
    return true
  }
  if (checking.value || refreshing.value) {
    return buildUpdateAvailable.value
  }

  checking.value = true

  try {
    const latest = await fetchLatestVersion()

    if (latest === null) {
      return buildUpdateAvailable.value
    }

    latestVersion.value = latest

    if (initialVersion.value === null) {
      initialVersion.value = latest
      return buildUpdateAvailable.value
    }

    const mismatch = latest !== initialVersion.value
    if (!mismatch) {
      removeAppliedVersion(latest)
      return false
    }
    if (latest === readDismissedVersion()) {
      return false
    }
    if (latest === readAppliedVersion()) {
      buildUpdateAvailable.value = false
      return false
    }
    buildUpdateAvailable.value = true

    return true
  } catch {
    return buildUpdateAvailable.value
  } finally {
    checking.value = false
  }
}

/**
 * Версия, для которой пользователь нажал «Позже».
 * @returns хэш отклонённого билда или null
 */
function readDismissedVersion(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/**
 * Версия, до которой пользователь уже обновился кнопкой «Обновить».
 * Баннер для неё больше не показывается (один деплой — один баннер).
 *
 * @returns хэш применённого билда или null
 */
function readAppliedVersion(): string | null {
  try {
    return window.localStorage.getItem(APPLIED_KEY)
  } catch {
    return null
  }
}

/**
 * Убрать метку применённой версии, когда она совпала с запущенной.
 * Хранилище не копит устаревшие хэши между деплоями.
 *
 * @param runningVersion версия, которую реально отдаёт сервер
 */
function removeAppliedVersion(runningVersion: string): void {
  try {
    if (window.localStorage.getItem(APPLIED_KEY) === runningVersion) {
      window.localStorage.removeItem(APPLIED_KEY)
    }
  } catch {}
}

/**
 * Скрыть баннер до следующего билда.
 * Запоминает текущую серверную версию, чтобы опросы не поднимали баннер снова.
 */
export function dismissBuildUpdate(): void {
  buildUpdateAvailable.value = false
  try {
    if (latestVersion.value) {
      window.localStorage.setItem(DISMISSED_KEY, latestVersion.value)
    }
  } catch {}
}

/**
 * Стереть весь кэш и перезагрузиться на свежий билд.
 *
 * Перед перезагрузкой пишет `APPLIED_KEY`: после релоада опрос сравнит
 * серверную версию с применённой и не поднимет баннер повторно,
 * даже если HTML/инстанс отдали stale-версию. Следующий деплой даст
 * новый хэш — баннер покажется снова ровно один раз.
 */
export async function refreshApp(): Promise<void> {
  if (refreshing.value) {
    return
  }

  refreshing.value = true
  buildUpdateAvailable.value = false

  let target = latestVersion.value
  if (target === null) {
    try {
      const fresh = await fetchLatestVersion()
      if (fresh !== null) {
        target = fresh
        latestVersion.value = fresh
      }
    } catch {}
  }

  try {
    window.localStorage.removeItem(DISMISSED_KEY)
    if (target !== null) {
      window.localStorage.setItem(APPLIED_KEY, target)
    }
  } catch {}

  try {
    await hardRefreshToLatest()
  } catch {
    window.location.reload()
  }
}

function handleVisibility(): void {
  if (document.visibilityState === 'visible') {
    void checkForBuildUpdate()
  }
}

function handleFocus(): void {
  void checkForBuildUpdate()
}

/**
 * Убрать служебный ?v= после жёсткого обновления.
 */
function stripRefreshParam(): void {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v')
      replaceUrlPreservingState(url.toString())
    }
  } catch {}
}

/**
 * Хук версии билда: опрос, флаги, жесткое обновление.
 */
export function useBuildVersion() {
  const hasBuildUpdate = computed(() => buildUpdateAvailable.value)

  function init(): void {
    if (inited) {
      return
    }

    inited = true
    stripRefreshParam()
    initialVersion.value = readInitialVersion()

    void checkForBuildUpdate()

    timer = setInterval(() => {
      void checkForBuildUpdate()
    }, POLL_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    try {
      offNavigate = router.on('navigate', () => {
        void checkForBuildUpdate()
      })
    } catch {}
  }

  function handleOnline(): void {
    void checkForBuildUpdate()
  }

  function destroy(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }

    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('focus', handleFocus)
    window.removeEventListener('online', handleOnline)
    offNavigate?.()
    offNavigate = null
  }

  onMounted(() => init())
  onBeforeUnmount(() => {})

  return {
    buildUpdateAvailable,
    hasBuildUpdate,
    checking,
    refreshing,
    latestVersion,
    init,
    destroy,
    checkForBuildUpdate,
    refreshApp,
    dismissBuildUpdate,
  }
}
