/**
 * Guard от лишних запросов: не отправлять на сервер данные без изменений.
 *
 * Сравнивает черновик из инпута с исходным значением в канонической форме:
 * строки триммятся, пустая строка, null и undefined считаются равными.
 * Использовать в любом save/submit перед сетевым вызовом.
 *
 * @example
 * import { isSameText, isUnchangedPayload } from '@/composables/useUnchangedGuard'
 *
 * async function save(): Promise<void> {
 *   if (isSameText(draft.value, original)) {
 *     return
 *   }
 *   await api.patch('/profile/thought', { thought: draft.value })
 * }
 */

/**
 * Приводит значение к канонической форме для сравнения.
 *
 * @param value любое значение из формы или с сервера
 * @returns строка без пробелов по краям (пустая — null), массивы — рекурсивно, остальное — как есть
 */
export function canonForCompare(value: unknown): unknown {
  if (typeof value === 'string') {
    const clean = value.trim()
    return clean === '' ? null : clean
  }
  if (value === undefined) {
    return null
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonForCompare(item))
  }
  return value
}

/**
 * Проверяет равенство двух текстов без учёта пробелов по краям.
 *
 * @param draft черновик из инпута/текстареи
 * @param original исходное значение
 * @returns true когда тексты совпадают (null/undefined/'' — равны)
 */
export function isSameText(draft: unknown, original: unknown): boolean {
  return canonForCompare(draft) === canonForCompare(original)
}

/**
 * Проверяет, что объект черновика совпадает с оригиналом по указанным ключам.
 *
 * @param draft черновик (например, payload формы)
 * @param original исходные данные (например, с сервера)
 * @param keys ключи для сравнения
 * @returns true когда все ключи совпадают в канонической форме
 */
export function isUnchangedPayload(
  draft: Record<string, unknown>,
  original: Record<string, unknown>,
  keys: string[],
): boolean {
  return keys.every((key) => {
    const left = JSON.stringify(canonForCompare(draft[key]))
    const right = JSON.stringify(canonForCompare(original[key]))
    return left === right
  })
}
