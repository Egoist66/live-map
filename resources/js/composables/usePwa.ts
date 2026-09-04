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

const needUpdate = ref(false)
const canInstall = ref(false)
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
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
    await applySwUpdate()
  }

  function dismissUpdate(): void {
    needUpdate.value = false
  }

  onMounted(() => init())
  onBeforeUnmount(() => {})

  return { supported, needUpdate, canInstall, online, standalone, displayMode, isNativeLike, init, promptInstall, applyUpdate, dismissUpdate, refresh }
}
