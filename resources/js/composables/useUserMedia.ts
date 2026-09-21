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
  const facing = ref<'user' | 'environment'>('user')

  /**
   * Захватить камеру и микрофон.
   *
   * Каскад попыток: сначала всё вместе, при отказе — только видео,
   * затем только аудио. Так звонок с одной камерой (или одним
   * микрофоном) всё равно состоится, а не упадёт целиком.
   *
   * @returns локальный поток
   */
  async function start(): Promise<MediaStream> {
    if (stream.value) return stream.value
    starting.value = true
    error.value = null
    try {
      const full = await tryCapture(true, true)
      if (full) return full
      const videoOnly = await tryCapture(true, false)
      if (videoOnly) {
        error.value = 'Микрофон недоступен — собеседник тебя не услышит'
        return videoOnly
      }
      const audioOnly = await tryCapture(false, true)
      if (audioOnly) {
        error.value = 'Камера недоступна — собеседник тебя не увидит'
        return audioOnly
      }
      error.value = 'Нет доступа к камере или микрофону — проверь разрешения браузера'
      throw new Error(error.value)
    } finally {
      starting.value = false
    }
  }

  /**
   * Одна попытка захвата с заданным набором устройств.
   *
   * @param video брать ли видео
   * @param audio брать ли аудио
   * @returns поток или null при отказе
   */
  async function tryCapture(video: boolean, audio: boolean): Promise<MediaStream | null> {
    try {
      const constraints: MediaStreamConstraints = {}
      if (video) {
        constraints.video = { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      } else {
        constraints.video = false
      }
      if (audio) {
        constraints.audio = { echoCancellation: true, noiseSuppression: true }
      } else {
        constraints.audio = false
      }
      const next = await navigator.mediaDevices.getUserMedia(constraints)
      stream.value = next
      const videoTrack = next.getVideoTracks()[0] ?? null
      const audioTrack = next.getAudioTracks()[0] ?? null
      hasVideo.value = !!videoTrack
      hasAudio.value = !!audioTrack
      return next
    } catch {
      return null
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
   * Переключить камеру фронталка↔тыльная (мобила).
   *
   * Новый трек берём ДО остановки старого: если устройство одно
   * или запрос отклонён — останемся на рабочей камере.
   *
   * @returns новый видеотрек или null
   */
  async function switchCamera(): Promise<MediaStreamTrack | null> {
    const old = stream.value?.getVideoTracks()[0] ?? null
    const nextFacing = facing.value === 'user' ? 'environment' : 'user'
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing } }, audio: false })
      const track = next.getVideoTracks()[0] ?? null
      if (!track || !stream.value) {
        try {
          next.getTracks().forEach((t) => t.stop())
        } catch {}
        return null
      }
      if (old) {
        stream.value.removeTrack(old)
        try {
          old.stop()
        } catch {}
      }
      stream.value.addTrack(track)
      facing.value = nextFacing
      return track
    } catch {
      return null
    }
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

  return { stream, starting, error, hasVideo, hasAudio, facing, start, toggleMute, toggleCamera, switchCamera, stop }
}
