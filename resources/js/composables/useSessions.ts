import { ref } from 'vue'
import { sessionsApi, devicesApi, type UserSession, type UserDeviceRow } from '@/services/sessions.api'

/**
 * Активные сеансы и доверенные устройства (Настройки → Безопасность → Сеансы).
 *
 * Сеансы тянутся из таблицы sessions (SESSION_DRIVER=database):
 * кто, откуда и с чего зашёл в аккаунт. Завершение чужого сеанса
 * удаляет его строку — устройство вылетает в гостя. Текущий сеанс
 * завершить нельзя. Устройства — user_devices: подтвердить («это я»),
 * завершить сеанс устройства или заблокировать навсегда.
 * Компонент только отображает и дёргает действия.
 *
 * @example
 * ```ts
 * const sessions = useSessions()
 * await sessions.load()
 * await sessions.closeOne('abc123')
 * ```
 *
 * @returns списки сеансов/устройств и действия над ними
 */
export function useSessions() {
  const items = ref<UserSession[]>([])
  const devices = ref<UserDeviceRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const closingId = ref<string | null>(null)
  const closingOthers = ref(false)
  const actingDeviceId = ref<number | null>(null)

  /**
   * Загрузить свежие списки сеансов и устройств.
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [sessionsRes, devicesRes] = await Promise.all([sessionsApi.list(), devicesApi.list()])
      items.value = sessionsRes.data
      devices.value = devicesRes
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message
      error.value = typeof message === 'string' && message !== '' ? message : 'Не удалось загрузить сеансы'
    } finally {
      loading.value = false
    }
  }

  /**
   * Завершить один чужой сеанс и убрать его из списка.
   *
   * @param id id строки sessions
   * @returns true когда сеанс закрыт
   */
  async function closeOne(id: string): Promise<boolean> {
    if (id === '' || closingId.value !== null) {
      return false
    }
    closingId.value = id
    try {
      await sessionsApi.close(id)
      items.value = items.value.filter((s) => s.id !== id)
      return true
    } catch {
      return false
    } finally {
      closingId.value = null
    }
  }

  /**
   * Завершить все сеансы кроме текущего.
   *
   * @returns число закрытых сеансов
   */
  async function closeOthers(): Promise<number> {
    if (closingOthers.value) {
      return 0
    }
    closingOthers.value = true
    try {
      const res = await sessionsApi.closeOthers()
      const closed = Number(res?.closed ?? 0)
      items.value = items.value.filter((s) => s.is_current)
      return closed
    } catch {
      return 0
    } finally {
      closingOthers.value = false
    }
  }

  /**
   * Действие над устройством: подтвердить, завершить сеанс,
   * заблокировать или разблокировать. После — освежить списки.
   *
   * @param id id устройства
   * @param action действие
   * @returns true когда сервер принял
   */
  async function deviceAction(id: number, action: 'trust' | 'terminate' | 'block' | 'unblock'): Promise<boolean> {
    if (!(id > 0) || actingDeviceId.value !== null) {
      return false
    }
    actingDeviceId.value = id
    try {
      if (action === 'trust') {
        await devicesApi.trust(id)
      } else if (action === 'terminate') {
        await devicesApi.terminate(id)
      } else if (action === 'block') {
        await devicesApi.block(id)
      } else {
        await devicesApi.unblock(id)
      }
      const [sessionsRes, devicesRes] = await Promise.all([sessionsApi.list(), devicesApi.list()])
      items.value = sessionsRes.data
      devices.value = devicesRes
      return true
    } catch {
      return false
    } finally {
      actingDeviceId.value = null
    }
  }

  return { items, devices, loading, error, closingId, closingOthers, actingDeviceId, load, closeOne, closeOthers, deviceAction }
}
