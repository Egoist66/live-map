import { busOn } from '@/services/realtime-bus'
import { sessionsApi } from '@/services/sessions.api'
import { stopRealtimePoller } from '@/composables/useRealtimePoller'

let bound = false

/**
 * Сторож отозванных сеансов: мгновенный вылет при кике.
 *
 * Убийство чужого сеанса удаляет его строку из sessions, но жертва
 * узнаёт об этом только следующим запросом. Сторож слушает
 * `user:session.revoked` (сокет) и тут же сверяет свой сеанс
 * через API: текущего среди живых нет — жёсткий вылет на логин
 * с полным ресетом состояния. Запасной путь без сокета — редирект
 * на 401/419 тика поллинга (см. noteFailure в useRealtimePoller).
 *
 * @example
 * ```ts
 * // в корневом лейауте один раз:
 * useSessionWatchdog()
 * ```
 */
export function useSessionWatchdog(): void {
  if (bound) {
    return
  }
  try {
    busOn('user:session.revoked', () => {
      void verifySession()
    })
    bound = true
  } catch {
    bound = false
  }
}

/**
 * Сверить свой сеанс со списком живых.
 *
 * Синтетический `live` (бэк подсовывает его, когда строки текущего
 * сеанса нет в таблице) живым не считаем: раз строки нет — сеанс
 * уже завершили с другого устройства, пора вылетать.
 */
async function verifySession(): Promise<void> {
  try {
    const res = await sessionsApi.list()
    const alive = res.data.some((s) => s.is_current && s.id !== 'live')
    if (!alive) {
      forceLogout()
    }
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 419) {
      forceLogout()
    }
  }
}

/**
 * Жёсткий вылет: стоп realtime, полный релоад на логин.
 */
function forceLogout(): void {
  try {
    stopRealtimePoller()
  } catch {
    // No-op: релоад всё равно снесёт состояние.
  }
  try {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
  } catch {
    // No-op: уже на логине или без window.
  }
}
