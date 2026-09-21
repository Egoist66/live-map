import { ref } from 'vue'

/**
 * Локальные медиа: камера + микрофон для видеозвонка.
 *
 * Один getUserMedia на сессию: поток переиспользуется между
 * «Дальше» в рулетке, треки гасятся только при выходе из звонка.
 *
 * @example
 * const media = useUserMedia()
 * await media.start()
 * videoEl.srcObject = media.stream.value
 */
export function useUserMedia() {
  const stream = ref<MediaStream | null>(null)
  const starting = ref(false)
  const error = ref<string | null>(null)
  const hasVideo = ref(true)
  const hasAudio = ref(true)

  /**
   * Захватить камеру и микрофон.
   *
   * @returns локальный поток
   */
  async function start(): Promise<MediaStream> {
    if (stream.value) return stream.value
    starting.value = true
    error.value = null
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      stream.value = next
      const videoTrack = next.getVideoTracks()[0] ?? null
      const audioTrack = next.getAudioTracks()[0] ?? null
      hasVideo.value = !!videoTrack
      hasAudio.value = !!audioTrack
      return next
    } catch {
      error.value = 'Нет доступа к камере или микрофону — проверь разрешения браузера'
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
   * Включить/выключить камеру.
   *
   * @returns true если камера теперь включена
   */
  function toggleCamera(): boolean {
    const track = stream.value?.getVideoTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    return track.enabled
  }

  /**
   * Погасить все треки и освободить устройства.
   */
  function stop(): void {
    try {
      stream.value?.getTracks().forEach((track) => track.stop())
    } catch {}
    stream.value = null
  }

  return { stream, starting, error, hasVideo, hasAudio, start, toggleMute, toggleCamera, stop }
}
