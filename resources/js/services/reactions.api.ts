import { api } from './api'
import type { ReactableType, ReactionType, ToggleReactionResponse, ReportPayload } from '@/types/entities/Reaction'

export interface PinLiker {
  user_id: number
  name: string
  avatar_url: string | null
  type: ReactionType
  created_at?: string
}

export const reactionsApi = {
  async toggle(reactable_type: ReactableType, reactable_id: number, type: ReactionType): Promise<ToggleReactionResponse> {
    const { data } = await api.post<ToggleReactionResponse>('/api/reactions/toggle', { reactable_type, reactable_id, type })
    return data
  },

  /**
   * Кто отреагировал на пин (для тултипа и модалки лайков).
   *
   * @param pinId id пина
   * @returns свежие реакции с пользователями и общее число
   */
  async likers(pinId: number): Promise<{ likers: PinLiker[]; total: number }> {
    const { data } = await api.get<{ likers: PinLiker[]; total: number }>(`/api/pins/${pinId}/likers`)
    return data
  },

  async report(target_type: string, target_id: number, reason = 'spam', description?: string): Promise<unknown> {
    const { data } = await api.post('/api/reports', { target_type, target_id, reason, description } as ReportPayload)
    return data
  },
}
