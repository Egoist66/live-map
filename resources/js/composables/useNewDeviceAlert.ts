import { ref } from 'vue'
import { busOn } from '@/services/realtime-bus'
import { devicesApi, type UserDeviceRow } from '@/services/sessions.api'
import { notificationsApi } from '@/services/notifications.api'

export type NewDeviceAction = 'trust' | 'terminate' | 'block'

/**
 * Данные нового устройства из inbox-строки security.new_device.
 */
export interface NewDeviceAlert {
  device_id: number
  label: string
  ip: string | null
  country: string | null
  city: string | null
  device: string
  platform: string | null
  browser: string | null
  client: string
  seen_at: string | null
}

let busBound = false

const open = ref(false)
const device = ref<NewDeviceAlert | null>(null)
const notificationId = ref<string | null>(null)
const acting = ref<NewDeviceAction | null>(null)
const error = ref<string | null>(null)

/**
 * Прилетающая модалка «Вход с нового устройства» (как в VK/Instagram).
 *
 * Открывается сама по realtime-событию user:notification.created
 * с типом security.new_device — и это же событие уже лежит
 * в колокольчике как обычное уведомление. Внутри три действия:
 * «Это я» (подтвердить), «Завершить сеанс» (мгновенный кик того,
 * кто вошёл) и «Заблокировать навсегда». После действия своя
 * inbox-строка помечается прочитанной. Компонент только рисует.
 *
 * @example
 * ```ts
 * // в корневом лейауте один раз:
 * useNewDeviceAlert()
 * // <NewDeviceAlertDialog />
 * ```
 *
 * @returns состояние модалки и действия
 */
export function useNewDeviceAlert() {
  ensureBusSync()

  /**
   * Открыть модалку по данным из inbox-строки.
   *
   * @param alert данные new_device из data строки
   * @param notifId id inbox-строки для автопрочтения
   */
  function openAlert(alert: NewDeviceAlert, notifId: string | null): void {
    device.value = alert
    notificationId.value = notifId
    error.value = null
    open.value = true
  }

  /**
   * Закрыть модалку без действий (устройство останется
   * неподтверждённым — кнопки есть в Настройках → Сеансы).
   */
  function close(): void {
    open.value = false
  }

  /**
   * Выполнить действие над устройством из модалки.
   *
   * @param action trust|terminate|block
   * @returns true когда действие принято сервером
   */
  async function act(action: NewDeviceAction): Promise<boolean> {
    const id = Number(device.value?.device_id ?? 0)
    if (!(id > 0) || acting.value !== null) {
      return false
    }
    acting.value = action
    error.value = null
    try {
      if (action === 'trust') {
        await devicesApi.trust(id)
      } else if (action === 'terminate') {
        await devicesApi.terminate(id)
      } else {
        await devicesApi.block(id)
      }
      await markOwnNotificationRead()
      open.value = false
      return true
    } catch {
      error.value = 'Не получилось — попробуй ещё раз'
      return false
    } finally {
      acting.value = null
    }
  }

  return { open, device, acting, error, openAlert, close, act }
}

/**
 * Разово подписаться на прилетающие алерты нового устройства.
 */
function ensureBusSync(): void {
  if (busBound) {
    return
  }
  busBound = true
  try {
    busOn('user:notification.created', (e: unknown) => {
      const row = (e as { notification?: Record<string, unknown> | null })?.notification
      if (!row || row.type !== 'security.new_device') {
        return
      }
      const payload = (row.data ?? {}) as { new_device?: NewDeviceAlert | null }
      const alert = payload.new_device ?? null
      if (!alert || Number(alert.device_id ?? 0) <= 0) {
        return
      }
      device.value = alert
      notificationId.value = typeof row.id === 'string' ? row.id : null
      error.value = null
      open.value = true
    })
  } catch {
    busBound = false
  }
}

/**
 * Пометить свою inbox-строку прочитанной после действия.
 */
async function markOwnNotificationRead(): Promise<void> {
  const id = notificationId.value
  if (!id) {
    return
  }
  try {
    await notificationsApi.markRead([id])
  } catch {
    // No-op: строка останется в колокольчике, не критично.
  }
}
