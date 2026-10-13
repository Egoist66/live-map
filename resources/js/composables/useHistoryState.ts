/**
 * Безопасная запись URL в историю без убийства навигации Inertia.
 *
 * Inertia хранит данные страницы в `history.state` и восстанавливает
 * их по кнопкам назад/вперёд. Голый `history.replaceState({}, url)`
 * затирает это состояние пустым объектом — возврат назад даёт белый
 * экран до ручной перезагрузки. Поэтому любая правка адресной строки
 * (чистка query-флагов, табы, фильтры) обязана идти через этот хелпер:
 * он сохраняет текущее `history.state` как есть.
 *
 * @example
 * ```ts
 * import { replaceUrlPreservingState } from '@/composables/useHistoryState'
 *
 * const url = new URL(window.location.href)
 * url.searchParams.delete('verified')
 * replaceUrlPreservingState(url.toString())
 * ```
 */

/**
 * Заменить текущий URL, сохранив состояние истории (данные Inertia).
 *
 * @param url новый URL целиком
 */
export function replaceUrlPreservingState(url: string): void {
  try {
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // No-op: адресная строка не критична для работы страницы.
  }
}

/**
 * Добавить запись в историю, сохранив состояние (данные Inertia).
 *
 * Дублирует текущий объект состояния в новую запись: назад вернёт
 * предыдущую страницу из её собственного состояния, а не пустоту.
 *
 * @param url новый URL целиком
 */
export function pushUrlPreservingState(url: string): void {
  try {
    window.history.pushState(window.history.state, '', url)
  } catch {
    // No-op: адресная строка не критична для работы страницы.
  }
}
