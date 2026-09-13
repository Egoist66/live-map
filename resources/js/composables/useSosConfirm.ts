import { ref } from 'vue'

/**
 * Код SOS-категории пинов.
 */
export const SOS_CATEGORY = 'sos'

/**
 * Заголовок предупреждения при выборе SOS.
 */
export const SOS_WARNING_TITLE = '🆘 SOS — только для экстренных ситуаций'

/**
 * Текст предупреждения об ответственности за ложный SOS.
 */
export const SOS_WARNING_TEXT =
  'SOS-пин означает, что случилось нечто очень срочное и нужна немедленная помощь. ' +
  'Вы несёте ответственность за ложное объявление чрезвычайной ситуации: ' +
  'пользователи вправе направить жалобу в отношении вас администрации приложения, ' +
  'а также в соответствующие органы.'

/**
 * Подтверждение ответственности за SOS-пин.
 *
 * Вся логика предупреждения живёт здесь: компонент только
 * показывает PrimeVue Dialog и вызывает действия хука.
 *
 * @returns состояние диалога, флаг подтверждения и действия
 * @example
 * const sos = useSosConfirm()
 * sos.requestSos(() => setValues({ category: 'sos' }))
 */
export function useSosConfirm() {
  const showSosWarning = ref(false)
  const sosConfirmed = ref(false)
  let pendingConfirm: (() => void) | null = null

  /**
   * Проверить, является ли значение SOS-категорией.
   * @param value значение категории
   * @returns true для SOS
   */
  function isSos(value: unknown): boolean {
    return String(value ?? '').toLowerCase() === SOS_CATEGORY
  }

  /**
   * Запросить выбор SOS: показать предупреждение либо сразу подтвердить,
   * если ответственность уже принята в этой форме.
   * @param onConfirm действие при подтверждённом выборе SOS
   */
  function requestSos(onConfirm: () => void): void {
    if (sosConfirmed.value) {
      onConfirm()
      return
    }
    pendingConfirm = onConfirm
    showSosWarning.value = true
  }

  /**
   * Принять ответственность и завершить выбор SOS.
   */
  function confirmSos(): void {
    sosConfirmed.value = true
    showSosWarning.value = false
    const run = pendingConfirm
    pendingConfirm = null
    run?.()
  }

  /**
   * Отклонить SOS: закрыть предупреждение без выбора категории.
   */
  function cancelSos(): void {
    showSosWarning.value = false
    pendingConfirm = null
  }

  /**
   * Сбросить подтверждение (при очистке формы).
   */
  function resetSos(): void {
    sosConfirmed.value = false
    showSosWarning.value = false
    pendingConfirm = null
  }

  return { showSosWarning, sosConfirmed, isSos, requestSos, confirmSos, cancelSos, resetSos }
}
