import { ref } from 'vue'

/**
 * Микрофон для голосового звонка: только аудио, камеру не трогаем
 * и разрешение на неё не спрашиваем.
 *
 * Один getUserMedia на сессию: поток переиспользуется между
 * «Дальше» в рулетке, треки гасятся только при выходе из звонка.
 *
 * @example
 * const media = useUserMedia()
 * await media.start()
 */
export function useUserMedia() {
  const stream = ref<MediaStream | null>(null)
  const starting = ref(false)
  const error = ref<string | null>(null)
  const hasAudio = ref(true)

  /**
   * Захватить микрофон.
   *
   * @returns аудиопоток без видеотреков
   * @throws Error когда микрофон недоступен
   */
  async function start(): Promise<MediaStream> {
    if (stream.value) return stream.value
    starting.value = true
    error.value = null
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      stream.value = next
      hasAudio.value = next.getAudioTracks().length > 0
      return next
    } catch {
      error.value = 'Нет доступа к микрофону — проверь разрешения браузера'
      throw new Error(error.value)
    } finally {
      starting.value = false
    }
  }

  /**
   * Включить/выключить микрофон.
   *
   * @returns true если звук теперь включён
   */
  function toggleMute(): boolean {
    const track = stream.value?.getAudioTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    return track.enabled
  }

  /**
   * Погасить все треки и освободить микрофон.
   */
  function stop(): void {
    try {
      stream.value?.getTracks().forEach((track) => track.stop())
    } catch {}
    stream.value = null
  }

  return { stream, starting, error, hasAudio, start, toggleMute, stop }
}
