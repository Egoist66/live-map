import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import {
  applyUpdate as applySwUpdate,
  canInstall as canInstallNow,
  getDisplayMode,
  isOnline as isOnlineNow,
  isStandalone as isStandaloneNow,
  isSupported as isSwSupported,
  onInstallChange,
  onOnlineChange,
  onUpdate,
  promptInstall as promptSwInstall,
  register as registerSw,
} from '@/pwa/pwa.service'
import type { PwaDisplayMode } from '@/pwa/types'

const SW_APPLIED_KEY = 'uconnect-sw-applied-at'
const SW_SUPPRESS_MS = 30 * 60 * 1000

const needUpdate = ref(false)
const canInstall = ref(false)
// Детерминированный старт для SSR: сервер и первая гидрация всегда
// видят online=true. Реальное значение подтягивается в init()/refresh()
// после монтирования (иначе офлайн-первый-визит даёт mismatch).
const online = ref(true)
const standalone = ref(false)
const displayMode = ref<PwaDisplayMode>('browser')
const supported = ref(false)
let inited = false
let offInstall: (() => void) | null = null
let offOnline: (() => void) | null = null

function refresh(): void {
  canInstall.value = canInstallNow()
  standalone.value = isStandaloneNow()
  displayMode.value = getDisplayMode()
  online.value = isOnlineNow()
}

/**
 * Проверить, применял ли пользователь SW-обновление недавно.
 *
 * После `applyUpdate` + перезагрузки браузер может снова отдать
 * `waiting`-воркер (stale SW) — без паузы баннер вернулся бы сразу,
 * и клики «Обновить» зациклились бы. Следующий деплой всё равно
 * поднимется через флаг билда, так что пауза безопасна.
 *
 * @returns true когда обновление применяли меньше 30 минут назад
 */
function isSwRecentlyApplied(): boolean {
  try {
    const raw = window.localStorage.getItem(SW_APPLIED_KEY)
    if (!raw) {
      return false
    }
    const appliedAt = Number(raw)
    if (!Number.isFinite(appliedAt)) {
      return false
    }
    return Date.now() - appliedAt < SW_SUPPRESS_MS
  } catch {
    return false
  }
}

/**
 * Запомнить момент применения SW-обновления (анти-луп баннера).
 */
function markSwApplied(): void {
  try {
    window.localStorage.setItem(SW_APPLIED_KEY, String(Date.now()))
  } catch {}
}

export function usePwa() {
  const isNativeLike = computed(() => standalone.value || displayMode.value !== 'browser')

  async function init(): Promise<void> {
    if (inited) return
    inited = true
    supported.value = isSwSupported()
    refresh()
    offInstall?.()
    offOnline?.()
    offInstall = onInstallChange(refresh)
    offOnline = onOnlineChange((v) => {
      online.value = v
    })
    onUpdate(() => {
      if (isSwRecentlyApplied()) {
        return
      }
      needUpdate.value = true
    })
    try {
      await registerSw()
    } catch {}
    refresh()
  }

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const outcome = await promptSwInstall()
    refresh()
    return outcome
  }

  async function applyUpdate(): Promise<void> {
    needUpdate.value = false
    markSwApplied()
    await applySwUpdate()
  }

  function dismissUpdate(): void {
    needUpdate.value = false
  }

  onMounted(() => init())
  onBeforeUnmount(() => {})

  return { supported, needUpdate, canInstall, online, standalone, displayMode, isNativeLike, init, promptInstall, applyUpdate, dismissUpdate, refresh }
}
