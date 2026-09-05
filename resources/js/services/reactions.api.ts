import { api } from './api'
import type { ReactableType, ReactionType, ToggleReactionResponse, ReportPayload } from '@/types/entities/Reaction'

export const reactionsApi = {
  async toggle(reactable_type: ReactableType, reactable_id: number, type: ReactionType): Promise<ToggleReactionResponse> {
    const { data } = await api.post<ToggleReactionResponse>('/api/reactions/toggle', { reactable_type, reactable_id, type })
    return data
  },

  async report(target_type: string, target_id: number, reason = 'spam', description?: string): Promise<unknown> {
    const { data } = await api.post('/api/reports', { target_type, target_id, reason, description } as ReportPayload)
    return data
  },
}
