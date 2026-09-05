import type { UserBrief } from './User'

export type PinCategory = 'question' | 'announcement' | 'warning' | 'event' | 'offer' | 'help'
export type PinPriority = 'normal' | 'sponsored' | 'pinned' | string
export type PinStatus = 'active' | 'expired' | 'blocked' | string
export type LocationPrecision = 'blur_200' | 'exact' | 'district' | 'custom'
export type BoostType = 'top' | 'glow' | 'notify' | 'extend'

export interface Pin {
  id: number
  title: string
  body: string | null
  category: PinCategory
  latitude: number
  longitude: number
  real_lat?: number | null
  real_lng?: number | null
  location_precision?: LocationPrecision
  is_blurred?: boolean
  blur_meters?: number
  blur_label?: string | null
  blur_hint?: string | null
  radius_meters: number
  visibility_radius_km: number
  expires_at: string
  boosted_until?: string | null
  status: PinStatus
  priority: PinPriority
  is_pinned: boolean
  is_sponsored: boolean
  is_boosted: boolean
  views_count: number
  likes_count: number
  reactions_count: number
  comments_count: number
  is_anonymous: boolean
  is_owner: boolean
  my_reaction: string | null
  user: UserBrief | null
  photo_path?: string | null
  district_name?: string | null
  created_at: string
  updated_at?: string
  distance?: number
}

export interface CreatePinPayload {
  title: string
  body?: string | null
  category: PinCategory
  latitude: number
  longitude: number
  location_precision?: LocationPrecision
  blur_meters?: number
  is_anonymous?: boolean
  radius_meters?: number
  photo_path?: string | null
}

export type UpdatePinPayload = Partial<Pick<CreatePinPayload, 'title' | 'body' | 'category'>>

export interface NearbyParams {
  lat: number
  lng: number
  radius?: number
}
