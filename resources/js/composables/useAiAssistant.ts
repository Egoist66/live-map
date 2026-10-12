import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAiAssistantStore } from '@/stores/aiAssistant'

/**
 * Хук AI-ассистента для компонентов: гид и разбор профиля.
 *
 * Модерации здесь нет: она полностью локальная
 * (useContentModeration, ноль токенов).
 * Вся логика живёт в Pinia-сторе, хук лишь отдаёт реактивное
 * состояние и экшены в удобной для шаблона форме.
 *
 * @returns состояние гида/профиля и экшены
 * @example
 * const { guideMessages, guideLoading, sendQuestion } = useAiAssistant()
 * await sendQuestion('Как работают свайпы?')
 */
export function useAiAssistant() {
  const store = useAiAssistantStore()
  const { guide, profile, ratings, commands } = storeToRefs(store)

  const guideMessages = computed(() => guide.value.messages)
  const guideLoading = computed(() => guide.value.loading)
  const guideRestoring = computed(() => guide.value.restoring)
  const guideError = computed(() => guide.value.error)
  const guideConversationId = computed(() => guide.value.conversationId)
  const hasGuideHistory = computed(() => guide.value.messages.length > 0)
  const lastAnswerRating = computed(() => {
    const id = guide.value.conversationId
    return id ? (ratings.value[id] ?? null) : null
  })

  const profileAnalysis = computed(() => profile.value.analysis)
  const profileLoading = computed(() => profile.value.loading)
  const profileError = computed(() => profile.value.error)
  const quickCommands = computed(() => commands.value)

  /**
   * Отправить вопрос гиду.
   * @param question вопрос пользователя
   */
  async function sendQuestion(question: string): Promise<void> {
    await store.askQuestion(question)
  }

  /**
   * Восстановить диалог после перезагрузки (кэш + история с сервера).
   */
  async function restoreGuide(): Promise<void> {
    await store.restoreGuide()
  }

  /**
   * Оценить последний ответ гида.
   * @param rating 1 — помогло, -1 — не помогло
   */
  async function rateAnswer(rating: 1 | -1): Promise<void> {
    await store.rateLastAnswer(rating)
  }

  /**
   * Подгрузить быстрые команды под модули пользователя.
   */
  async function loadQuickCommands(): Promise<void> {
    await store.loadQuickCommands()
  }

  /**
   * Разобрать свой дейтинг-профиль.
   */
  async function analyzeProfile(): Promise<void> {
    await store.analyzeMyProfile()
  }

  /**
   * Сбросить диалог с гидом.
   */
  function resetGuide(): void {
    store.resetGuide()
  }

  return {
    guideMessages,
    guideLoading,
    guideRestoring,
    guideError,
    guideConversationId,
    hasGuideHistory,
    lastAnswerRating,
    profileAnalysis,
    profileLoading,
    profileError,
    quickCommands,
    sendQuestion,
    restoreGuide,
    rateAnswer,
    loadQuickCommands,
    analyzeProfile,
    resetGuide,
  }
}
