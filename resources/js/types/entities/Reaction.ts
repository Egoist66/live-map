export type ReactionType = 'like' | 'fire' | 'laugh' | 'sad' | 'angry' | 'useful'
export type ReactableType = 'pin' | 'comment'

export interface Reaction {
  id: number
  user_id: number
  reactable_type: ReactableType
  reactable_id: number
  type: ReactionType
  created_at: string
  updated_at: string
}

export interface ToggleReactionPayload {
  reactable_type: ReactableType
  reactable_id: number
  type: ReactionType
}

export interface ToggleReactionResponse {
  reacted: boolean
  type: ReactionType | null
  switched?: boolean
  reactions_count: number
  likes_count: number
}

export interface ReportPayload {
  target_type: 'pin' | 'comment' | string
  target_id: number
  reason: string
  description?: string
}
