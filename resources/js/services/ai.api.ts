import { api } from './api'

/**
 * Вердикт текстовой модерации от `POST /api/ai/moderate`.
 */
export interface AiSafetyVerdict {
  is_toxic: boolean
  category: string | null
  confidence: string | null
  reason: string | null
  source: 'regex' | 'ai' | 'fallback' | 'empty'
}

/**
 * Ответ гида по приложению от `POST /api/ai/ask`.
 */
export interface AiGuideAnswer {
  answer: string
  conversation_id: string | null
}

/**
 * Разбор дейтинг-профиля от `POST /api/ai/profile-analysis`.
 */
export interface AiProfileAnalysis {
  score: number
  strengths: string[]
  fixes: string[]
  bio_variants: string[]
  icebreakers: string[]
}

/**
 * Диалог с гидом из `GET /api/ai/conversations`.
 */
export interface AiConversationItem {
  id: string
  title: string
  updated_at: string | null
}

/**
 * Сообщение истории из `GET /api/ai/conversations/{id}`.
 */
export interface AiHistoryMessage {
  role: 'user' | 'assistant' | string
  text: string
  at: string | null
}

/**
 * Быстрая команда гида из `GET /api/ai/quick-commands`.
 */
export interface AiQuickCommand {
  icon: string
  label: string
  question: string
  module: string | null
}

/**
 * Черновик анкеты от `POST /api/ai/questionnaire-draft` (Premium).
 */
export interface QuestionnaireDraft {
  goal: 'love' | 'flirt' | 'friendship' | 'chat' | 'interests' | null
  custom_goal: string | null
  about: string
  interests: string[]
}

/**
 * Конверт ответов AI-контроллера: `{ data: T }`.
 */
interface AiEnvelope<T> {
  data: T
}

export const aiApi = {
  /**
   * Проверить текст на токсичность (regex + OpenRouter при нужде).
   * @param text текст до 2000 символов
   * @returns вердикт модерации
   */
  async moderateText(text: string): Promise<AiSafetyVerdict> {
    const { data } = await api.post<AiEnvelope<AiSafetyVerdict>>('/api/ai/moderate', { text })
    return data.data
  },

  /**
   * Спросить гида о приложении, продолжая диалог.
   * @param question вопрос до 1000 символов
   * @param conversationId id диалога либо null для продолжения последнего
   * @returns ответ и id диалога для следующих вопросов
   */
  async askGuide(question: string, conversationId?: string | null): Promise<AiGuideAnswer> {
    const { data } = await api.post<AiEnvelope<AiGuideAnswer>>('/api/ai/ask', {
      question,
      conversation_id: conversationId ?? null,
    })
    return data.data
  },

  /**
   * Разобрать свой дейтинг-профиль (сервер режет частоту: 10/час).
   * @returns оценка, сильные стороны, исправления, варианты био и фразы
   */
  async analyzeProfile(): Promise<AiProfileAnalysis> {
    const { data } = await api.post<AiEnvelope<AiProfileAnalysis>>('/api/ai/profile-analysis')
    return data.data
  },

  /**
   * Сгенерировать черновик анкеты по промпту (Premium, сервер режет частоту: 10/час).
   * Промпт и результат проходят модерацию на бэке.
   * @param prompt описание желаемой анкеты до 500 символов
   * @returns черновик: цель, своя цель, о себе, интересы
   */
  async draftQuestionnaire(prompt: string): Promise<QuestionnaireDraft> {
    const { data } = await api.post<AiEnvelope<QuestionnaireDraft>>('/api/ai/questionnaire-draft', { prompt })
    return data.data
  },

  /**
   * Список диалогов с гидом (восстановление после перезагрузки).
   * @param limit сколько диалогов отдать
   */
  async listConversations(limit = 20): Promise<AiConversationItem[]> {
    const { data } = await api.get<AiEnvelope<AiConversationItem[]>>('/api/ai/conversations', { params: { limit } })
    return data.data
  },

  /**
   * История сообщений диалога в хронологическом порядке.
   * @param id id диалога
   */
  async getConversationMessages(id: string): Promise<AiHistoryMessage[]> {
    const { data } = await api.get<AiEnvelope<AiHistoryMessage[]>>(`/api/ai/conversations/${id}`)
    return data.data
  },

  /**
   * Оценить ответ гида (обучающий сигнал для базы знаний).
   * @param conversationId оцениваемый диалог
   * @param rating 1 — помогло, -1 — не помогло
   */
  async sendFeedback(conversationId: string, rating: 1 | -1): Promise<{ id: number; rating: number }> {
    const { data } = await api.post<AiEnvelope<{ id: number; rating: number }>>('/api/ai/feedback', {
      conversation_id: conversationId,
      rating,
    })
    return data.data
  },

  /**
   * Быстрые команды гида под включённые у пользователя модули.
   */
  async getQuickCommands(): Promise<AiQuickCommand[]> {
    const { data } = await api.get<AiEnvelope<AiQuickCommand[]>>('/api/ai/quick-commands')
    return data.data
  },
}
