import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Полноэкранный режим сцены видеозвонка.
 *
 * Каскад: нативный Fullscreen API сцены → нативный fullscreen видео
 * (iOS `webkitEnterFullscreen`) → CSS-псевдофулскрин (`fixed inset-0`).
 * Последний шаг гарантирует, что кнопка «Во весь экран» работает везде,
 * включая iPhone, где `requestFullscreen` для div нет.
 *
 * @example
 * const fs = useVideoFullscreen()
 * <div :ref="fs.setStageEl" :class="fs.stageClass.value">…</div>
 * <Button icon="pi pi-expand" @click="fs.toggleFullscreen(() => v.remoteRef.value)" />
 */
export function useVideoFullscreen() {
  const stageRef = ref<HTMLDivElement | null>(null)
  const isFullscreen = ref(false)
  const pseudoFullscreen = ref(false)

  /**
   * Ref-колбэк сцены звонка (стабильная ссылка — без мерцания).
   *
   * @param el DOM-узел сцены или null при размонтировании
   */
  function setStageEl(el: unknown): void {
    stageRef.value = el as HTMLDivElement | null
  }

  /**
   * Синхронизировать флаг с нативным fullscreen-состоянием.
   */
  function syncState(): void {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
      mozFullScreenElement?: Element | null
    }
    const native = !!document.fullscreenElement || !!doc.webkitFullscreenElement || !!doc.mozFullScreenElement
    isFullscreen.value = native || pseudoFullscreen.value
  }

  /**
   * Попросить элемент уйти в нативный fullscreen (с префиксами).
   *
   * @param target целевой элемент
   * @returns true если запрос принят
   */
  async function enterNative(target: HTMLElement): Promise<boolean> {
    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen()
        return true
      }
      const prefixed = target as HTMLElement & {
        webkitRequestFullscreen?: () => void
        mozRequestFullScreen?: () => void
      }
      if (prefixed.webkitRequestFullscreen) {
        prefixed.webkitRequestFullscreen()
        return true
      }
      if (prefixed.mozRequestFullScreen) {
        prefixed.mozRequestFullScreen()
        return true
      }
    } catch {
      return false
    }
    return false
  }

  /**
   * Переключить полноэкранный режим сцены и обратно.
   *
   * @param getVideo геттер удалённого <video> для iOS-фолбэка
   */
  async function toggleFullscreen(getVideo?: () => HTMLVideoElement | null): Promise<void> {
    if (pseudoFullscreen.value) {
      pseudoFullscreen.value = false
      syncState()
      return
    }
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {}
      return
    }
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    if (doc.webkitFullscreenElement) {
      try {
        const docExit = document as Document & { webkitExitFullscreen?: () => void }
        docExit.webkitExitFullscreen?.()
      } catch {}
      return
    }
    const stage = stageRef.value
    if (stage) {
      const entered = await enterNative(stage)
      if (entered) {
        return
      }
    }
    const video = getVideo?.() ?? null
    const iosVideo = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (iosVideo) {
      try {
        if (iosVideo.webkitEnterFullscreen) {
          iosVideo.webkitEnterFullscreen()
          return
        }
      } catch {}
      const entered = await enterNative(iosVideo)
      if (entered) {
        return
      }
    }
    pseudoFullscreen.value = true
    syncState()
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', syncState)
    document.addEventListener('webkitfullscreenchange', syncState as EventListener)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', syncState)
    document.removeEventListener('webkitfullscreenchange', syncState as EventListener)
    pseudoFullscreen.value = false
  })

  return { stageRef, isFullscreen, pseudoFullscreen, setStageEl, toggleFullscreen }
}
