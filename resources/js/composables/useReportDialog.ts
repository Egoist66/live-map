import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { reactionsApi } from '@/services/reactions.api'

export type ReportTargetType = 'pin' | 'comment' | 'user'

export const REPORT_REASONS = [
  { v: 'spam', l: 'Спам' },
  { v: 'abuse', l: 'Оскорбления' },
  { v: 'inappropriate', l: 'Неприемлемый контент' },
  { v: 'illegal', l: 'Нарушение закона' },
  { v: 'fake', l: 'Фейк / недостоверно' },
] as const

/**
 * Диалог жалобы: выбор причины + отправка модераторам.
 *
 * Почта автора должна быть подтверждена, иначе итог проверки
 * придёт только в личку приложения (inbox), а не письмом.
 * Жалобу принимаем в любом случае — бэк вернёт `inbox_only`,
 * хук показывает предупреждение и тост с пояснением.
 *
 * @returns состояние диалога и действия
 */
export function useReportDialog() {
  const open = ref(false)
  const targetType = ref<ReportTargetType>('pin')
  const targetId = ref<number | null>(null)
  const targetTitle = ref('')
  const reason = ref<string>('spam')
  const description = ref('')
  const sending = ref(false)
  const inboxOnly = ref(false)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  /**
   * Подтверждена ли почта текущего пользователя.
   */
  const emailVerified = (() => {
    try {
      const page = usePage()
      return computed(() => !!((page.props.auth as any)?.user?.email_verified_at))
    } catch {
      return computed(() => true)
    }
  })()

  function openReport(type: ReportTargetType, id: number, title = '') {
    targetType.value = type
    targetId.value = id
    targetTitle.value = title
    reason.value = 'spam'
    description.value = ''
    open.value = true
  }

  function close() {
    open.value = false
  }

  async function submit() {
    if (!targetId.value || sending.value) return
    sending.value = true
    inboxOnly.value = false
    try {
      const res: any = await reactionsApi.report(targetType.value, targetId.value, reason.value, description.value.trim() || undefined)
      inboxOnly.value = !!(res as any)?.inbox_only || !emailVerified.value
      close()
      toast?.add({
        severity: 'success',
        summary: 'Жалоба отправлена',
        detail: inboxOnly.value
          ? 'Итог проверки придёт в приложение (колокольчик) — почта не подтверждена'
          : 'Модерация проверит в ближайшее время',
        life: 3500,
      })
    } catch (e: any) {
      const dup = e?.response?.status === 409
      toast?.add({ severity: dup ? 'info' : 'error', summary: dup ? 'Жалоба уже отправлена' : (e?.response?.data?.message || 'Не удалось отправить жалобу'), life: 3000 })
    } finally {
      sending.value = false
    }
  }

  return { open, targetType, targetId, targetTitle, reason, description, sending, emailVerified, inboxOnly, openReport, close, submit }
}
