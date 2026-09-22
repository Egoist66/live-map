import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { chatApi } from '@/services/chat.api'

/**
 * Публичная страница компании: написать владельцу в чат.
 *
 * @param ownerId id владельца компании
 * @returns флаг отправки и действие чата
 * @example const { writing, writeToCompany } = useBusinessPublicPage(owner.id)
 */
export function useBusinessPublicPage(ownerId: number) {
  const writing = ref(false)

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  /**
   * Открыть диалог с компанией (создать при отсутствии).
   */
  async function writeToCompany(): Promise<void> {
    if (writing.value) {
      return
    }
    writing.value = true
    try {
      const conversation = (await chatApi.createConversation(ownerId)) as { id?: number; conversation?: { id?: number } }
      const conversationId = conversation?.id ?? conversation?.conversation?.id
      router.visit(conversationId ? `/chat/${conversationId}` : '/chat')
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast?.add({ severity: 'warn', summary: 'Не получилось написать', detail: message ?? 'Попробуйте позже', life: 4000 })
    } finally {
      writing.value = false
    }
  }

  return { writing, writeToCompany }
}
