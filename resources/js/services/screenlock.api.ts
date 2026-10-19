import { api } from './api'

/**
 * API скринлокера: флаг активности и сброс забытого кода.
 *
 * Сам код блокировки на сервер не уходит — он живёт в IndexedDB. Серверу
 * нужен только факт «локер включён» (чтобы показать сброс в боте) и
 * подтверждённый запрос на стирание локального кода.
 */
export const screenLockApi = {
  /**
   * Сообщить серверу, включён ли скринлокер на этом устройстве.
   *
   * @param active включён ли локер
   * @returns true, если сервер принял значение
   */
  async reportActive(active: boolean): Promise<boolean> {
    try {
      const { data } = await api.post('/api/screen-lock/active', { active })
      return data?.ok === true
    } catch {
      return false
    }
  },

  /**
   * Запросить 6-значный код сброса на почту аккаунта.
   *
   * @returns серверный ответ с флагом успеха и паузой до повтора
   */
  async requestCode(): Promise<{ ok: boolean; message: string; retry_after: number }> {
    try {
      const { data } = await api.post('/api/screen-lock/code')
      return {
        ok: data?.ok === true,
        message: String(data?.message ?? ''),
        retry_after: Number(data?.retry_after ?? 0),
      }
    } catch (error: any) {
      const payload = error?.response?.data
      return {
        ok: false,
        message: String(payload?.message ?? 'Не удалось отправить код'),
        retry_after: Number(payload?.retry_after ?? 0),
      }
    }
  },

  /**
   * Проверить код из письма и сбросить код блокировки.
   *
   * @param code 6-значный код из письма
   * @returns серверный ответ с флагом успеха и меткой сброса
   */
  async verifyCode(code: string): Promise<{ ok: boolean; message: string; reset_at: number }> {
    try {
      const { data } = await api.post('/api/screen-lock/verify', { code })
      return {
        ok: data?.ok === true,
        message: String(data?.message ?? ''),
        reset_at: Number(data?.reset_at ?? 0),
      }
    } catch (error: any) {
      const payload = error?.response?.data
      return {
        ok: false,
        message: String(payload?.message ?? 'Неверный код'),
        reset_at: Number(payload?.reset_at ?? 0),
      }
    }
  },
}
