import { onBeforeUnmount } from 'vue'

/**
 * Двухтональный рингтон входящего звонка на WebAudio.
 *
 * Безопасен к автоплей-политике: контекст создаётся и будится только
 * при пользовательской активности (иначе Chrome держит его suspended
 * и пишет `AudioContext was not allowed to start`), на первое касание
 * висит разовый unlock-слушатель. Вибрация — только после жеста
 * (иначе `Blocked call to navigator.vibrate`).
 *
 * @example
 * const ring = useRingtone()
 * watch(visible, (open) => { if (open) ring.startRing(); else ring.stopRing() })
 */
export function useRingtone() {
  let audioCtx: AudioContext | null = null
  let ringTimer: ReturnType<typeof setInterval> | null = null
  let gestureBound = false
  let unlockPointer: (() => void) | null = null
  let unlockKey: (() => void) | null = null

  /**
   * Была ли пользовательская активность (липкий флаг браузера).
   *
   * @returns true когда жест уже был — можно будить звук и вибрировать
   */
  function hasActivation(): boolean {
    try {
      const nav = navigator as Navigator & {
        userActivation?: { hasBeenActive?: boolean; isActive?: boolean }
      }
      if (nav.userActivation) {
        return !!(nav.userActivation.hasBeenActive || nav.userActivation.isActive)
      }
    } catch {}
    return false
  }

  /**
   * Создать (или разбудить) AudioContext.
   *
   * @returns контекст или null когда звук запрещён
   */
  function ensureCtx(): AudioContext | null {
    try {
      if (!audioCtx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtx = new Ctor()
      }
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume().catch(() => {})
      }
      return audioCtx
    } catch {
      return null
    }
  }

  /**
   * Один бип рингтона.
   *
   * @param ctx живой контекст
   * @param high высокий ли тон
   */
  function beep(ctx: AudioContext, high: boolean): void {
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = high ? 660 : 520
      osc.type = 'sine'
      gain.gain.value = 0.06
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
      osc.stop(ctx.currentTime + 0.36)
    } catch {}
  }

  /**
   * Разовый unlock звука на первое касание (жест будит suspended-контекст).
   */
  function bindGestureUnlock(): void {
    if (gestureBound || typeof window === 'undefined') {
      return
    }
    gestureBound = true
    unlockPointer = () => {
      try {
        if (audioCtx && audioCtx.state === 'suspended') {
          void audioCtx.resume().catch(() => {})
        }
      } catch {}
    }
    unlockKey = unlockPointer
    window.addEventListener('pointerdown', unlockPointer, { passive: true })
    window.addEventListener('keydown', unlockKey)
  }

  /**
   * Запустить рингтон и вибрацию (вибрация — только после жеста).
   */
  function startRing(): void {
    stopRing()
    bindGestureUnlock()
    try {
      if (hasActivation() && 'vibrate' in navigator) {
        navigator.vibrate([300, 150, 300])
      }
    } catch {}
    let high = false
    ringTimer = setInterval(() => {
      const ctx = ensureCtx()
      if (!ctx || ctx.state !== 'running') {
        return
      }
      beep(ctx, high)
      high = !high
    }, 450)
  }

  /**
   * Остановить рингтон.
   */
  function stopRing(): void {
    if (ringTimer) {
      clearInterval(ringTimer)
    }
    ringTimer = null
  }

  onBeforeUnmount(() => {
    stopRing()
    try {
      if (unlockPointer) {
        window.removeEventListener('pointerdown', unlockPointer)
      }
      if (unlockKey) {
        window.removeEventListener('keydown', unlockKey)
      }
    } catch {}
    unlockPointer = null
    unlockKey = null
    gestureBound = false
  })

  return { startRing, stopRing }
}
