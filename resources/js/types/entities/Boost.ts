import type { BoostType } from './Pin'

export interface PinBoost {
  id: number
  pin_id: number
  user_id: number
  type: BoostType
  duration_hours: number
  price: number
  starts_at: string
  ends_at: string
  created_at: string
  updated_at: string
}

export interface BoostPayload {
  type: BoostType
}
