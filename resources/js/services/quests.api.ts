import { api } from '@/services/api'

/**
 * API заданий для PRO-недели.
 */
export interface QuestItem {
  code: string
  title: string
  desc: string
  hint: string
  xp: number
  target: number
  icon: string
  progress: number
  completed: boolean
  completed_at: string | null
  percent: number
}

export interface QuestTrack {
  code: string
  completed_count: number
  total: number
  is_complete: boolean
  total_xp: number
  earned_xp: number
  quests: QuestItem[]
}

export interface QuestState {
  cycle_key: string
  rating: any
  tracks: Record<'pins' | 'swipes', QuestTrack>
  can_claim: Record<'pins' | 'swipes', { allowed: boolean; reason: string | null }>
  cooldown_until: string | null
  on_cooldown: boolean
  cooldown_days_left: number
  is_premium: boolean
  premium_from_quest: boolean
  premium_expires_at: string | null
  last_reward: { track: string; granted_at: string; expires_at: string } | null
  premium_days: number
  cooldown_days: number
}

/**
 * Загрузить состояние заданий.
 * @returns состояние треков, рейтинга и PRO
 */
export async function fetchQuests(): Promise<QuestState> {
  const { data } = await api.get('/api/quests')
  return data as QuestState
}

/**
 * Пересчитать прогресс после действий.
 * @returns свежее состояние
 */
export async function refreshQuests(): Promise<QuestState> {
  const { data } = await api.post('/api/quests/refresh')
  return data as QuestState
}

/**
 * Забрать PRO-неделю за трек.
 * @param track pins|swipes
 * @returns результат выдачи
 */
export async function claimQuestPremium(track: 'pins' | 'swipes'): Promise<any> {
  const { data } = await api.post('/api/quests/claim', { track })
  return data
}
