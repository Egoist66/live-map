import { ref, computed, onBeforeUnmount } from 'vue'

/** Макс длительность голосового сообщения в секундах. */
export const VOICE_MAX_SECONDS = 60

/** Битрейт записи: 32 кбит/с opus — минута весит ~250 КБ. */
const VOICE_BITRATE = 32000

const PREFERRED_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

/**
 * Форматирует секунды в m:ss для таймера и подписей.
 *
 * @param total секунд
 * @returns строка вида "0:07" или "1:00"
 * @example
 * formatVoiceTime(75) // "1:15"
 */
export function formatVoiceTime(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const minutes = Math.floor(s / 60)
  const seconds = String(s % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

/**
 * Запись голосовых сообщений через MediaRecorder.
 *
 * Оптимизация: opus/webm с битрейтом 32 кбит/с и моно — минута
 * занимает сотни килобайт. Лимит 60 c: на лимите запись
 * останавливается сама и уходит в превью для прослушивания.
 * Уровень микрофона отдаётся для анимации кнопки записи.
 *
 * @returns состояние записи и действия
 * @example
 * const voice = useVoiceRecorder()
 * await voice.start()
 * const done = voice.finish() // { file, duration } | null
 */
export function useVoiceRecorder() {
  const isRecording = ref(false)
  const duration = ref(0)
  const level = ref(0)
  const error = ref<string | null>(null)
  const previewUrl = ref<string | null>(null)
  const previewDuration = ref(0)
  const hasPreview = computed(() => previewUrl.value !== null)

  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let previewBlob: Blob | null = null
  let mimeType = ''
  let timer: ReturnType<typeof setInterval> | null = null
  let startedAt = 0
  let rafId = 0
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let levelData: Uint8Array<ArrayBuffer> | null = null

  /**
   * Выбирает первый поддерживаемый браузером mime для записи.
   *
   * @returns mime или пустая строка для дефолта браузера
   */
  function pickMimeType(): string {
    try {
      if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
        return ''
      }
      for (const mime of PREFERRED_MIMES) {
        if (MediaRecorder.isTypeSupported(mime)) {
          return mime
        }
      }
    } catch {}
    return ''
  }

  /**
   * Расширение файла под выбранный mime.
   *
   * @returns webm, m4a или ogg
   */
  function extForMime(): string {
    if (mimeType.includes('mp4')) {
      return 'm4a'
    }
    if (mimeType.includes('ogg')) {
      return 'ogg'
    }
    return 'webm'
  }

  function clearTimer(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function stopLevelMeter(): void {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {})
      audioCtx = null
    }
    analyser = null
    levelData = null
    level.value = 0
  }

  function stopStream(): void {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
      stream = null
    }
  }

  /**
   * Кадр измерителя уровня микрофона для анимации.
   */
  function tickLevel(): void {
    rafId = 0
    if (!analyser || !levelData) {
      return
    }
    analyser.getByteTimeDomainData(levelData)
    let peak = 0
    for (let i = 0; i < levelData.length; i += 2) {
      const v = Math.abs((levelData[i] as number) - 128) / 128
      if (v > peak) {
        peak = v
      }
    }
    level.value = Math.min(1, peak * 1.6)
    rafId = requestAnimationFrame(tickLevel)
  }

  /**
   * Запускает измеритель уровня с микрофонного потока.
   */
  function startLevelMeter(): void {
    try {
      if (!stream) {
        return
      }
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
      if (!Ctx) {
        return
      }
      audioCtx = new Ctx()
      const source = audioCtx.createMediaStreamSource(stream)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      levelData = new Uint8Array(analyser.fftSize)
      source.connect(analyser)
      rafId = requestAnimationFrame(tickLevel)
    } catch {}
  }

  function clearPreview(): void {
    const url = previewUrl.value
    previewUrl.value = null
    previewDuration.value = 0
    previewBlob = null
    if (url) {
      try {
        URL.revokeObjectURL(url)
      } catch {}
    }
  }

  /**
   * Начинает запись с микрофона.
   *
   * @returns true если запись пошла
   */
  async function start(): Promise<boolean> {
    error.value = null
    if (isRecording.value) {
      return true
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      error.value = 'Браузер не поддерживает запись аудио'
      return false
    }
    if (typeof MediaRecorder === 'undefined') {
      error.value = 'Браузер не поддерживает запись аудио'
      return false
    }
    try {
      clearPreview()
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch {
      error.value = 'Нет доступа к микрофону — разрешите доступ и попробуйте снова'
      return false
    }
    try {
      mimeType = pickMimeType()
      chunks = []
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: VOICE_BITRATE })
        : new MediaRecorder(stream, { audioBitsPerSecond: VOICE_BITRATE })
    } catch {
      stopStream()
      error.value = 'Не удалось начать запись'
      return false
    }
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data)
      }
    }
    recorder.onstop = () => {
      buildPreview()
    }
    startedAt = Date.now()
    duration.value = 0
    recorder.start(250)
    isRecording.value = true
    startLevelMeter()
    clearTimer()
    timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      duration.value = Math.min(elapsed, VOICE_MAX_SECONDS)
      if (elapsed >= VOICE_MAX_SECONDS) {
        void stop()
      }
    }, 250)
    return true
  }

  /**
   * Собирает записанное в превью для прослушивания перед отправкой.
   */
  function buildPreview(): void {
    clearTimer()
    stopLevelMeter()
    stopStream()
    isRecording.value = false
    const blobType = mimeType.split(';')[0] || 'audio/webm'
    const blob = new Blob(chunks, { type: blobType })
    chunks = []
    if (blob.size === 0) {
      error.value = 'Запись пустая — попробуйте ещё раз'
      return
    }
    const finalDuration = Math.max(1, Math.min(VOICE_MAX_SECONDS, duration.value || 1))
    previewBlob = blob
    previewUrl.value = URL.createObjectURL(blob)
    previewDuration.value = finalDuration
  }

  /**
   * Останавливает запись и кладёт результат в превью.
   *
   * @returns void
   */
  async function stop(): Promise<void> {
    if (!isRecording.value || !recorder) {
      return
    }
    clearTimer()
    try {
      recorder.stop()
    } catch {
      buildPreview()
    }
  }

  /**
   * Отменяет запись без превью.
   */
  async function cancel(): Promise<void> {
    if (!isRecording.value) {
      clearPreview()
      duration.value = 0
      return
    }
    clearTimer()
    const rec = recorder
    recorder = null
    chunks = []
    if (rec) {
      rec.onstop = () => {
        stopLevelMeter()
        stopStream()
      }
      try {
        rec.stop()
      } catch {
        stopLevelMeter()
        stopStream()
      }
    } else {
      stopLevelMeter()
      stopStream()
    }
    isRecording.value = false
    duration.value = 0
  }

  /**
   * Забирает превью файлом для отправки и чистит состояние.
   *
   * @returns файл с длительностью или null без превью
   */
  function finish(): { file: File; duration: number } | null {
    const blob = previewBlob
    if (!blob) {
      return null
    }
    const blobType = mimeType.split(';')[0] || 'audio/webm'
    const fileName = `voice-${Date.now()}.${extForMime()}`
    const secs = previewDuration.value
    clearPreview()
    duration.value = 0
    const file = new File([blob], fileName, { type: blobType })
    return { file, duration: secs }
  }

  /**
   * Убирает превью без отправки.
   */
  function discardPreview(): void {
    clearPreview()
    duration.value = 0
  }

  onBeforeUnmount(() => {
    clearTimer()
    stopLevelMeter()
    stopStream()
    clearPreview()
    recorder = null
    chunks = []
  })

  return {    isRecording,
    duration,
    level,
    error,
    previewUrl,
    previewDuration,
    hasPreview,
    start,
    stop,
    cancel,
    finish,
    discardPreview,
  }
}
