import { onMounted, ref, watch } from 'vue'

/**
 * Ключ флага «анимации выключены» в localStorage.
 */
export const MOTION_OFF_STORAGE_KEY = 'motion-off'

/**
 * Детерминированный старт для SSR: сервер и первая гидрация всегда
 * видят `false`. Реальное значение из localStorage подтягивается
 * в onMounted (после гидрации), поэтому mismatch исключён.
 */
const motionOff = ref(false)
let synced = false

/**
 * Применяет флаг к документу: класс `motion-off` на `<html>`
 * гасит все transition/animation через CSS kill-switch в app.css.
 *
 * @param value true — анимации выключены
 */
function applyMotion(value: boolean): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('motion-off', value)
}

/**
 * Синхронизирует флаг с браузером (только клиент, после гидрации).
 */
function syncFromBrowser(): void {
  if (typeof window === 'undefined' || synced) {
    return
  }

  synced = true

  try {
    motionOff.value = localStorage.getItem(MOTION_OFF_STORAGE_KEY) === '1'
  } catch {
    motionOff.value = false
  }

  applyMotion(motionOff.value)
}

watch(motionOff, (value) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(MOTION_OFF_STORAGE_KEY, value ? '1' : '0')
  } catch {}

  applyMotion(value)
})

/**
 * Глобальная синхронизация флага после гидрации (только клиент).
 * Вызывается один раз из app.ts рядом с `initTheme`.
 */
export function initMotion(): void {
  if (typeof window === 'undefined' || synced) {
    return
  }

  setTimeout(() => syncFromBrowser(), 0)
}

/**
 * Доступ к настройке анимаций. Первый вызов в браузере планирует
 * синхронизацию с localStorage после монтирования (без mismatch).
 *
 * @returns флаг отключения анимаций и переключатели
 * @example
 * const { motionOff, setMotionOff } = useMotion()
 */
export function useMotion() {
  if (typeof window !== 'undefined') {
    try {
      onMounted(() => syncFromBrowser())
    } catch {}
  }

  /**
   * Включает/выключает все анимации приложения.
   *
   * @param value true — выключить анимации
   */
  function setMotionOff(value: boolean): void {
    motionOff.value = value
  }

  function toggleMotionOff(): void {
    motionOff.value = !motionOff.value
  }

  return { motionOff, setMotionOff, toggleMotionOff }
}
