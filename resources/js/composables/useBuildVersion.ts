import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { api } from '@/services/api'
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

const POLL_INTERVAL_MS = 5 * 60 * 1000

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
  const response = await api.get('/api/version')
  const version = (response.data as Record<string, unknown>)?.version
  return typeof version === 'string' && version !== '' ? version : null
}

/**
 * Сверить версию билда с сервером.
 */
export async function checkForBuildUpdate(): Promise<boolean> {
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
    buildUpdateAvailable.value = mismatch

    return mismatch
  } catch {
    return buildUpdateAvailable.value
  } finally {
    checking.value = false
  }
}

/**
 * Стереть весь кэш и перезагрузиться на свежий билд.
 */
export async function refreshApp(): Promise<void> {
  if (refreshing.value) {
    return
  }

  refreshing.value = true
  buildUpdateAvailable.value = false

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
    initialVersion.value = readInitialVersion()

    void checkForBuildUpdate()

    timer = setInterval(() => {
      void checkForBuildUpdate()
    }, POLL_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    try {
      offNavigate = router.on('navigate', () => {
        const fresh = readInitialVersion()
        if (fresh !== null) {
          initialVersion.value = fresh
        }
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
  }
}
