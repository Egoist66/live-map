import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { districtsApi } from '@/services/districts.api'
import { useBusinessAccount } from '@/composables/useBusinessAccount'

/**
 * Заявка в район с целью вступления (общая логика для всех точек входа).
 *
 * Организации вступают через модалку `DistrictJoinRequestDialog`:
 * цель обязательна (минимум 10 символов) — организатор по ней решает
 * принять, отклонить или связаться. Персоны вступают в один клик,
 * цель — по желанию (тоже через ту же модалку при прямом вызове
 * openDialog, либо молча через request()).
 *
 * @returns состояние модалки и действия заявки
 * @example
 * const joinRequest = useDistrictJoinRequest()
 * await joinRequest.request(id, name, () => refresh())
 */
export function useDistrictJoinRequest() {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  const { isBusiness } = useBusinessAccount()

  /** Модалка цели вступления открыта. */
  const dialogOpen = ref(false)
  const districtId = ref(0)
  const districtName = ref('')
  const message = ref('')
  const sending = ref(false)
  let afterSend: (() => void | Promise<void>) | null = null

  /**
   * Показать ошибку тостом.
   *
   * @param error ответ API
   * @param fallback запасной текст
   */
  function fail(error: unknown, fallback: string): void {
    const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
    toast?.add({ severity: 'error', summary: 'Район', detail, life: 4000 })
  }

  /**
   * Прямая отправка заявки.
   *
   * @param id id района
   * @param purpose цель вступления
   * @returns true когда заявка принята бэком
   */
  async function send(id: number, purpose = ''): Promise<boolean> {
    if (sending.value) return false
    sending.value = true
    try {
      await districtsApi.join(id, purpose)
      toast?.add({
        severity: 'success',
        summary: 'Заявка отправлена',
        detail: 'Владелец решит: принять, отклонить или связаться с вами',
        life: 3500,
      })
      return true
    } catch (error: unknown) {
      fail(error, 'Не удалось отправить заявку')
      return false
    } finally {
      sending.value = false
    }
  }

  /**
   * Точка входа заявки: организация — модалка цели, персона — сразу.
   *
   * @param id id района
   * @param name название района для заголовка модалки
   * @param onSent колбэк после успешной отправки (обновить список/карточку)
   */
  async function request(id: number, name: string, onSent?: () => void | Promise<void>): Promise<void> {
    if (!(id > 0)) return
    afterSend = onSent ?? null
    if (isBusiness.value) {
      districtId.value = id
      districtName.value = name
      message.value = ''
      dialogOpen.value = true
      return
    }
    const ok = await send(id)
    if (ok && afterSend) {
      await afterSend()
    }
  }

  /**
   * Подтвердить заявку из модалки (с целью).
   */
  async function confirm(): Promise<void> {
    const ok = await send(districtId.value, message.value)
    if (!ok) return
    dialogOpen.value = false
    message.value = ''
    if (afterSend) {
      await afterSend()
    }
    afterSend = null
  }

  return {
    dialogOpen,
    districtId,
    districtName,
    message,
    sending,
    isBusiness,
    request,
    confirm,
  }
}
