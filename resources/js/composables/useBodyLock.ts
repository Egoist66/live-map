import { useScrollLock } from '@/composables/useScrollLock'

/**
 * Блокирует прокрутку body, пока активен флаг (модалки, оверлеи).
 * На сервере (SSR) — no-op: `document` там нет, immediate-watcher молча выходит.
 *
 * Делегирует в ref-counted `useScrollLock`, поэтому безопасно
 * комбинируется с другими локами (превью аватара, маски Dialog):
 * скролл вернётся, только когда закроется последний оверлей.
 *
 * @param getActive геттер флага активности
 * @param owner имя владельца лока
 */
export function useBodyLock(getActive: () => boolean, owner = 'body-lock') {
  useScrollLock(getActive, owner)
}
