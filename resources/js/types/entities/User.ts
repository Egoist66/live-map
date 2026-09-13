export type UserPlan = 'free' | 'pro' | 'business'
export type UserRole = 'user' | 'moderator' | 'admin'
export type UserLevel = 'novice' | 'explorer' | 'local' | 'veteran' | string
export type UserGender = 'male' | 'female' | 'other'
export type DefaultMode = 'ulove' | 'upin'

export interface User {
  id: number
  name: string
  gender: UserGender | null
  email: string
  email_verified_at: string | null
  signup_goal?: string | null
  default_mode?: DefaultMode | null
  default_mode_set_at?: string | null
  avatar_path: string | null
  avatar_url: string | null
  home_lat: number | null
  home_lng: number | null
  home_radius_km: number | null
  reputation_score: number
  level: UserLevel
  is_anonymous_default: boolean
  plan: UserPlan
  plan_expires_at: string | null
  pins_today_count: number
  pins_today_date: string | null
  role: UserRole
  is_admin: boolean
  is_moderator?: boolean
  created_at?: string
  updated_at?: string
}

export interface UserBrief {
  id: number
  name: string
  avatar_path: string | null
  avatar_url: string | null
  level: UserLevel
}

export interface AuthUser extends User {
  canCreatePin?: boolean
}
