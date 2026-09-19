import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useFlowStore } from '@/stores/flow'
import { useRewardToast } from '@/composables/useRewardToast'
import { flowApi } from '@/services/flow.api'

/**
 * Голосование в опросах UFlow: один голос, смена запрещена.
 *
 * Состояние опроса живёт в сторе поста — лента, профиль и диплинк
 * видят один результат. Ошибки показывает тостом, оптимистично
 * счётчики не трогаем: сервер возвращает свежий опрос целиком.
 *
 * @example
 * const poller = useFlowPoll()
 * await poller.vote(post.id, poll.id, option.id)
 */
export function useFlowPoll() {
  const store = useFlowStore()
  const rewards = useRewardToast()
  const busy = ref<Record<number, boolean>>({})
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /**
   * Проверка занятости опроса.
   * @param pollId опрос
   */
  function isBusy(pollId: number): boolean {
    return !!busy.value[pollId]
  }

  /**
   * Процент голосов варианта.
   * @param votes голоса варианта
   * @param total всего голосов
   */
  function percent(votes: number, total: number): number {
    if (!total) return 0
    return Math.round((votes / total) * 100)
  }

  /**
   * Подпись состояния опроса.
   * @param poll опрос
   */
  function closesLabel(poll: { closed: boolean; closes_at: string | null }): string {
    if (poll.closed) return 'Опрос завершён'
    if (!poll.closes_at) return 'Бессрочный опрос'
    try {
      const date = new Date(poll.closes_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      return `До ${date}`
    } catch {
      return ''
    }
  }

  /**
   * Проголосовать за вариант.
   * @param postId пост для обновления в сторе
   * @param pollId опрос
   * @param optionId вариант
   * @returns true при успехе
   */
  async function vote(postId: number, pollId: number, optionId: number): Promise<boolean> {
    if (busy.value[pollId]) return false
    busy.value = { ...busy.value, [pollId]: true }
    try {
      const poll = await flowApi.vote(pollId, optionId)
      store.applyPoll(postId, poll)
      rewards.applyReward(poll)
      return true
    } catch (error) {
      const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не вышло проголосовать'
      toast?.add({ severity: 'error', summary: 'Опрос', detail, life: 3000 })
      return false
    } finally {
      const next = { ...busy.value }
      delete next[pollId]
      busy.value = next
    }
  }

  /**
   * Закрыть опрос досрочно (автор или админ).
   * @param postId пост для обновления в сторе
   * @param pollId опрос
   */
  async function close(postId: number, pollId: number): Promise<boolean> {
    if (busy.value[pollId]) return false
    busy.value = { ...busy.value, [pollId]: true }
    try {
      const poll = await flowApi.closePoll(pollId)
      store.applyPoll(postId, poll)
      return true
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло закрыть опрос', life: 2500 })
      return false
    } finally {
      const next = { ...busy.value }
      delete next[pollId]
      busy.value = next
    }
  }

  return { busy, isBusy, percent, closesLabel, vote, close }
}
