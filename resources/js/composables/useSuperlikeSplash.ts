import { ref } from 'vue'
import { shouldSkipMotion } from '@/composables/useMotion'

/**
 * Состояние сплеша суперлайка: синяя вспышка поверх колоды.
 *
 * Компонент `SuperlikeSplash` только отображает `active` и `burstKey`,
 * всю логику показа/скрытия держит этот хук (Правило №1).
 *
 * @returns флаг сплеша, ключ залпа для перезапуска анимации и триггер
 * @example const splash = useSuperlikeSplash(); splash.fire()
 */
export function useSuperlikeSplash() {
  const active = ref(false)
  const burstKey = ref(0)

  let hideTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Уважает системное «уменьшить движение» и глобальный kill-switch.
   *
   * @returns true когда тяжёлую анимацию надо пропустить
   */
  function motionOff(): boolean {
    try {
      if (shouldSkipMotion()) {
        return true
      }
    } catch {
      return false
    }

    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  }

  /**
   * Показать сплеш суперлайка на ~1.1с.
   *
   * Повторный вызов перезапускает анимацию через `burstKey`.
   * При выключенных анимациях — короткая вспышка без частиц.
   */
  function fire(): void {
    burstKey.value += 1
    active.value = true

    try {
      navigator.vibrate?.([30, 50, 30])
    } catch {
      // No-op: вибрация не критична.
    }

    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }

    const ttl = motionOff() ? 450 : 1150

    hideTimer = setTimeout(() => {
      active.value = false
      hideTimer = null
    }, ttl)
  }

  return { active, burstKey, fire }
}
