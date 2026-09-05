import { ref } from 'vue'
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

export function useReportDialog() {
  const open = ref(false)
  const targetType = ref<ReportTargetType>('pin')
  const targetId = ref<number | null>(null)
  const targetTitle = ref('')
  const reason = ref<string>('spam')
  const description = ref('')
  const sending = ref(false)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

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
    try {
      await reactionsApi.report(targetType.value, targetId.value, reason.value, description.value.trim() || undefined)
      close()
      toast?.add({ severity: 'success', summary: 'Жалоба отправлена', detail: 'Модерация проверит в ближайшее время', life: 3000 })
    } catch (e: any) {
      const dup = e?.response?.status === 409
      toast?.add({ severity: dup ? 'info' : 'error', summary: dup ? 'Жалоба уже отправлена' : (e?.response?.data?.message || 'Не удалось отправить жалобу'), life: 3000 })
    } finally {
      sending.value = false
    }
  }

  return { open, targetType, targetId, targetTitle, reason, description, sending, openReport, close, submit }
}
