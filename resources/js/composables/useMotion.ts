import { computed, onMounted, ref, watch } from 'vue'

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
 * Проверяет системный `prefers-reduced-motion` (только клиент).
 * На сервере всегда false — SSR-разметка детерминирована.
 *
 * @returns true если ОС просит уменьшить движение
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Нужно ли пропускать JS-ожидания анимаций (улёт свайпа и т.п.).
 * True когда анимации выключены в настройках ИЛИ их просит
 * выключить ОС. SSR-безопасно: на сервере всегда false.
 *
 * Без этого `swipe()` ждал бы 360мс несуществующую анимацию
 * (keyframes убиты kill-switch за 0.01мс) — мёртвый фриз
 * при каждом свайпе с выключенными анимациями.
 *
 * @returns true если анимацию ждать не надо
 */
export function shouldSkipMotion(): boolean {
  return motionOff.value || prefersReducedMotion()
}

/**
 * Доступ к настройке анимаций. Первый вызов в браузере планирует
 * синхронизацию с localStorage после монтирования (без mismatch).
 *
 * Свитч в UI — позитивный: ON = анимации ВКЛЮЧЕНЫ (по умолчанию).
 * Внутренности хранят инверсию `motionOff`, наружу торчат оба флага.
 *
 * @returns флаги и переключатели анимаций
 * @example
 * const { animationsEnabled, setAnimationsEnabled } = useMotion()
 */
export function useMotion() {
  if (typeof window !== 'undefined') {
    try {
      onMounted(() => syncFromBrowser())
    } catch {}
  }

  /**
   * Анимации включены (инверсия внутреннего флага).
   * Writable: можно биндить напрямую в `v-model` PrimeVue ToggleSwitch.
   */
  const animationsEnabled = computed({
    get: () => !motionOff.value,
    set: (value: boolean) => {
      motionOff.value = !value
    },
  })

  /**
   * Включает/выключает все анимации приложения.
   *
   * @param value true — анимации включены
   */
  function setAnimationsEnabled(value: boolean): void {
    motionOff.value = !value
  }

  function toggleAnimations(): void {
    motionOff.value = !motionOff.value
  }

  /**
   * Включает/выключает все анимации приложения (негативная форма).
   *
   * @param value true — выключить анимации
   * @deprecated используй setAnimationsEnabled
   */
  function setMotionOff(value: boolean): void {
    motionOff.value = value
  }

  function toggleMotionOff(): void {
    motionOff.value = !motionOff.value
  }

  return { motionOff, animationsEnabled, setAnimationsEnabled, toggleAnimations, setMotionOff, toggleMotionOff }
}
