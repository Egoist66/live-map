import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { formatVoiceTime } from '@/composables/useVoiceRecorder'

/** Аудио, играющее сейчас: новый плеер ставит старый на паузу. */
let activeAudio: HTMLAudioElement | null = null

/**
 * Плеер голосового сообщения: play/pause, прогресс, перемотка кликом.
 *
 * Длительность берётся из сервера (attachment.duration), пока метаданные
 * аудио не загрузились — подпись не прыгает. Одновременно играет
 * только один плеер: старт нового ставит предыдущий на паузу.
 *
 * @param fallbackDuration длительность с сервера в секундах
 * @returns состояние плеера и действия
 * @example
 * const player = useVoicePlayer(12)
 * // <audio :src="url" :ref="(el) => player.audioRef = el" />
 */
export function useVoicePlayer(fallbackDuration?: number | null) {
  const audioRef = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)
  const current = ref(0)
  const total = ref(Number(fallbackDuration) > 0 ? Number(fallbackDuration) : 0)
  const error = ref<string | null>(null)

  const progress = computed(() => {
    if (!total.value) {
      return 0
    }
    return Math.max(0, Math.min(1, current.value / total.value))
  })
  const currentLabel = computed(() => formatVoiceTime(current.value))
  const totalLabel = computed(() => formatVoiceTime(total.value))

  function detach(el: HTMLAudioElement | null): void {
    if (!el) {
      return
    }
    el.onplay = null
    el.onpause = null
    el.ontimeupdate = null
    el.onloadedmetadata = null
    el.onended = null
    el.onerror = null
    if (activeAudio === el) {
      activeAudio = null
    }
  }

  /**
   * Вешает слушатели аудиоэлемента и сбрасывает позицию.
   *
   * @param el аудиоэлемент
   */
  function attach(el: HTMLAudioElement): void {
    el.onplay = () => {
      isPlaying.value = true
      if (activeAudio && activeAudio !== el) {
        activeAudio.pause()
      }
      activeAudio = el
    }
    el.onpause = () => {
      isPlaying.value = false
      if (activeAudio === el) {
        activeAudio = null
      }
    }
    el.ontimeupdate = () => {
      current.value = el.currentTime || 0
    }
    el.onloadedmetadata = () => {
      error.value = null
      if (Number.isFinite(el.duration) && el.duration > 0) {
        total.value = el.duration
      }
    }
    el.onerror = () => {
      isPlaying.value = false
      error.value = 'Не удалось загрузить аудио — проверьте соединение'
    }
    el.onended = () => {
      isPlaying.value = false
      current.value = 0
      if (activeAudio === el) {
        activeAudio = null
      }
    }
  }

  watch(audioRef, (next, prev) => {
    if (prev) {
      detach(prev)
    }
    if (next) {
      attach(next)
    }
  })

  /**
   * Старт/пауза воспроизведения.
   */
  function toggle(): void {
    const el = audioRef.value
    if (!el) {
      return
    }
    if (el.paused) {
      error.value = null
      el.play().catch(() => {
        error.value = 'Не удалось воспроизвести — файл заблокирован или недоступен'
      })
      return
    }
    el.pause()
  }

  /**
   * Перемотка кликом по полосе прогресса.
   *
   * @param e клик по полосе
   */
  function seek(e: MouseEvent): void {
    const el = audioRef.value
    const bar = e.currentTarget as HTMLElement | null
    if (!el || !bar || !total.value) {
      return
    }
    const rect = bar.getBoundingClientRect()
    if (!rect.width) {
      return
    }
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    el.currentTime = ratio * total.value
    current.value = el.currentTime
  }

  onBeforeUnmount(() => {
    detach(audioRef.value)
    audioRef.value = null
  })

  return { audioRef, isPlaying, current, total, progress, currentLabel, totalLabel, error, toggle, seek }
}
