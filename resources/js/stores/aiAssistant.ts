import { defineStore } from 'pinia'
import { ref } from 'vue'
import { aiApi, type AiGuideAnswer, type AiProfileAnalysis, type AiQuickCommand } from '@/services/ai.api'

/**
 * Сообщение диалога с гидом.
 */
export interface AiGuideMessage {
  role: 'user' | 'assistant'
  text: string
  /** ISO-дата для подписи времени, null у старых кэшей. */
  at?: string | null
}

/**
 * Ключи localStorage: указатель на диалог, кэш сообщений и оценки.
 * Сервер — источник правды (таблицы agent_conversations*), локально
 * лишь указатель + мгновенный кэш для первой отрисовки.
 */
const GUIDE_ID_KEY = 'ai.guide.conversationId'
const GUIDE_CACHE_KEY = 'ai.guide.cache'
const GUIDE_RATINGS_KEY = 'ai.guide.ratings'
const GUIDE_CACHE_LIMIT = 60

/**
 * Pinia-стор текстового AI-ассистента: гид и разбор профиля.
 *
 * Модерации здесь нет: она полностью локальная
 * (useContentModeration, ноль токенов).
 *
 * Состояние сгруппировано объектами по смыслу (гид / модерация / профиль),
 * вся асинхронность — через async/await, ошибки складываются в поля error.
 * Диалог гида переживает перезагрузку: conversationId + кэш в localStorage,
 * полная история догружается с сервера.
 */
export const useAiAssistantStore = defineStore('aiAssistant', () => {
  const guide = ref<{ messages: AiGuideMessage[]; conversationId: string | null; loading: boolean; restoring: boolean; error: string | null }>({
    messages: [],
    conversationId: null,
    loading: false,
    restoring: false,
    error: null,
  })

  const profile = ref<{ analysis: AiProfileAnalysis | null; loading: boolean; error: string | null; checkedAt: string | null }>({
    analysis: null,
    loading: false,
    error: null,
    checkedAt: null,
  })

  const ratings = ref<Record<string, 1 | -1>>(readRatings())

  const commands = ref<AiQuickCommand[]>([])
  const commandsLoaded = ref(false)

  /**
   * Задать вопрос гиду и дописать пару сообщений в историю.
   * @param question вопрос пользователя
   */
  async function askQuestion(question: string): Promise<AiGuideAnswer | null> {
    const clean = question.trim()
    if (clean === '' || guide.value.loading) return null
    guide.value.loading = true
    guide.value.error = null
    guide.value.messages.push({ role: 'user', text: clean, at: new Date().toISOString() })
    try {
      const answer = await aiApi.askGuide(clean, guide.value.conversationId)
      guide.value.conversationId = answer.conversation_id
      guide.value.messages.push({ role: 'assistant', text: answer.answer, at: new Date().toISOString() })
      persistGuide()
      return answer
    } catch (e: any) {
      guide.value.messages.pop()
      guide.value.error = e?.response?.data?.message ?? 'Гид недоступен, попробуйте позже.'
      return null
    } finally {
      guide.value.loading = false
    }
  }

  /**
   * Восстановить диалог после перезагрузки: указатель из localStorage,
   * сообщения — мгновенно из кэша, затем полная история с сервера.
   */
  async function restoreGuide(): Promise<void> {
    if (guide.value.messages.length > 0 || guide.value.restoring) return
    const storedId = readStoredId()
    const cached = readCache()
    if (cached.length > 0) {
      guide.value.messages = cached
      guide.value.conversationId = storedId
    }
    if (!storedId) return
    guide.value.restoring = true
    try {
      const history = await aiApi.getConversationMessages(storedId)
      guide.value.messages = history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        text: m.text,
        at: m.at,
      }))
      guide.value.conversationId = storedId
      persistGuide()
    } catch {
      clearPersistedGuide()
      if (guide.value.messages.length === 0) guide.value.conversationId = null
    } finally {
      guide.value.restoring = false
    }
  }

  /**
   * Оценить последний ответ гида (сигнал для базы знаний).
   * @param rating 1 — помогло, -1 — не помогло
   */
  async function rateLastAnswer(rating: 1 | -1): Promise<boolean> {
    const id = guide.value.conversationId
    if (!id || ratings.value[id] !== undefined) return false
    try {
      await aiApi.sendFeedback(id, rating)
      ratings.value[id] = rating
      writeRatings(ratings.value)
      return true
    } catch {
      return false
    }
  }

  /**
   * Разобрать свой дейтинг-профиль.
   */
  async function analyzeMyProfile(): Promise<AiProfileAnalysis | null> {
    if (profile.value.loading) return null
    profile.value.loading = true
    profile.value.error = null
    try {
      const analysis = await aiApi.analyzeProfile()
      profile.value.analysis = analysis
      profile.value.checkedAt = new Date().toISOString()
      return analysis
    } catch (e: any) {
      const status = e?.response?.status
      profile.value.error = status === 429
        ? 'Разбор доступен 10 раз в час. Попробуйте позже.'
        : (e?.response?.data?.message ?? 'Разбор недоступен, попробуйте позже.')
      return null
    } finally {
      profile.value.loading = false
    }
  }

  /**
   * Подгрузить быстрые команды под модули пользователя (один раз за сессию).
   */
  async function loadQuickCommands(): Promise<void> {
    if (commandsLoaded.value) return
    commandsLoaded.value = true
    try {
      commands.value = await aiApi.getQuickCommands()
    } catch {
      commands.value = []
    }
  }

  /**
   * Начать диалог с гидом заново.
   */
  function resetGuide(): void {
    guide.value.messages = []
    guide.value.conversationId = null
    guide.value.error = null
    clearPersistedGuide()
  }

  /**
   * Сохранить указатель диалога и кэш сообщений.
   */
  function persistGuide(): void {
    try {
      if (guide.value.conversationId) {
        localStorage.setItem(GUIDE_ID_KEY, guide.value.conversationId)
      }
      localStorage.setItem(GUIDE_CACHE_KEY, JSON.stringify(guide.value.messages.slice(-GUIDE_CACHE_LIMIT)))
    } catch {}
  }

  return { guide, profile, ratings, commands, askQuestion, restoreGuide, rateLastAnswer, loadQuickCommands, analyzeMyProfile, resetGuide }
})

/**
 * Прочитать сохранённый id диалога.
 */
function readStoredId(): string | null {
  try {
    return localStorage.getItem(GUIDE_ID_KEY)
  } catch {
    return null
  }
}

/**
 * Прочитать кэш сообщений диалога.
 */
function readCache(): AiGuideMessage[] {
  try {
    const raw = localStorage.getItem(GUIDE_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', text: m.text, at: typeof m.at === 'string' ? m.at : null }))
  } catch {
    return []
  }
}

/**
 * Прочитать оценки диалогов.
 */
function readRatings(): Record<string, 1 | -1> {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUIDE_RATINGS_KEY) ?? '{}')
    if (parsed && typeof parsed === 'object') return parsed as Record<string, 1 | -1>
    return {}
  } catch {
    return {}
  }
}

/**
 * Сохранить оценки диалогов.
 */
function writeRatings(value: Record<string, 1 | -1>): void {
  try {
    localStorage.setItem(GUIDE_RATINGS_KEY, JSON.stringify(value))
  } catch {}
}

/**
 * Очистить локальный указатель и кэш диалога.
 */
function clearPersistedGuide(): void {
  try {
    localStorage.removeItem(GUIDE_ID_KEY)
    localStorage.removeItem(GUIDE_CACHE_KEY)
  } catch {}
}
