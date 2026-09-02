import type { UserBrief } from './User'

export interface PinComment {
  id: number
  pin_id: number
  user_id: number
  parent_id: number | null
  content: string
  is_anonymous: boolean
  user: UserBrief | null
  replies?: PinComment[]
  reactions_count?: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface CreateCommentPayload {
  content: string
  parent_id?: number | null
  is_anonymous?: boolean
}

export interface UpdateCommentPayload {
  content: string
}
