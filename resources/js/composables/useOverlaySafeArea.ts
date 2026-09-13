import { readonly, ref } from 'vue'

/** Замеренный верхний инсет (вырез/шторка), px. Единственный источник для JS. */
const safeTop = ref(0)
/** Замеренный нижний инсет (жесты/панель), px. Единственный источник для JS. */
const safeBottom = ref(0)

/**
 * Единый контроллер безопасной области всего интерфейса.
 *
 * Замеряет реальные инсеты (вырез/шторка/жесты) и кладёт их в
 * `--sat-real`/`--sab-real` на `<html>`, добавляет класс `overlay-safe`.
 * Весь CSS (шапка, нижнее меню, баннеры, тосты, карта, чат, PrimeVue
 * Dialog/Drawer/Toast/Popover/Select/DatePicker и кастомные шиты) опирается
 * только на `--sat`/`--sab` — ни один компонент не считает отступы сам
 * через `env()`, поэтому ничто не налазит на системные иконки, батарею
 * и область жестов ни в WebView, ни в мобильном браузере.
 *
 * Вызывать один раз на старте из `app.ts`.
 *
 * @returns init для однократного запуска и readonly-инсеты для JS
 * @example
 * const { initOverlaySafeArea, safeTop } = useOverlaySafeArea()
 * initOverlaySafeArea()
 */
export function useOverlaySafeArea() {
  let inited = false
  let rafId = 0

  /**
   * Замеряет раскрытое значение env() через невидимый пробный узел.
   *
   * @param property проверяемое свойство ('top' или 'bottom')
   * @returns высота инсета в пикселях
   */
  function measureInset(property: 'top' | 'bottom'): number {
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.position = 'fixed'
    probe.style.left = '0'
    probe.style.top = '0'
    probe.style.visibility = 'hidden'
    probe.style.pointerEvents = 'none'
    if (property === 'top') {
      probe.style.paddingTop = 'env(safe-area-inset-top, 0px)'
    } else {
      probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)'
    }
    document.body.appendChild(probe)
    const styles = getComputedStyle(probe)
    const raw = property === 'top' ? styles.paddingTop : styles.paddingBottom
    probe.remove()
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : 0
  }

  /**
   * Применяет замеренные инсеты как CSS-переменные на <html>.
   *
   * Нулевой замер означает «env() пуст» — переменные не трогаем,
   * остаются env()-значения и фолбэк `.no-safe-area-top` из CSS.
   *
   * @returns void
   */
  function applyInsets(): void {
    rafId = 0
    const root = document.documentElement
    const top = measureInset('top')
    const bottom = measureInset('bottom')
    safeTop.value = Math.round(top)
    safeBottom.value = Math.round(bottom)
    if (top > 0) {
      root.style.setProperty('--sat-real', `${Math.round(top)}px`)
    }
    if (bottom > 0) {
      root.style.setProperty('--sab-real', `${Math.round(bottom)}px`)
    }
  }

  /**
   * Пересчёт через rAF, чтобы пачка resize-событий не дёргала layout.
   *
   * @returns void
   */
  function scheduleApply(): void {
    if (rafId) {
      return
    }
    rafId = requestAnimationFrame(applyInsets)
  }

  /**
   * Однократная инициализация контроллера.
   *
   * @returns void
   */
  function initOverlaySafeArea(): void {
    if (inited) {
      return
    }
    inited = true
    document.documentElement.classList.add('overlay-safe')
    applyInsets()
    const viewport = window.visualViewport
    if (viewport) {
      viewport.addEventListener('resize', scheduleApply)
    }
    window.addEventListener('resize', scheduleApply)
    window.addEventListener('orientationchange', scheduleApply)
  }

  return { initOverlaySafeArea, safeTop: readonly(safeTop), safeBottom: readonly(safeBottom) }
}
