/**
 * Сущности кабинета бизнеса (РБ-законодательство).
 */
export type AccountType = 'person' | 'business'

export type BusinessLegalForm =
  | 'ooo'
  | 'ip'
  | 'odo'
  | 'zao'
  | 'self_employed'
  | 'craft'
  | 'other'

export type BusinessVerificationStatus = 'draft' | 'pending' | 'verified' | 'rejected'

export interface BusinessProfile {
  id: number
  name: string
  category: string | null
  address: string | null
  lat: number | null
  lng: number | null
  description: string | null
  phone: string | null
  website: string | null
  working_hours: Record<string, string> | null
  is_verified: boolean
  logo_url: string | null
  legal_form: BusinessLegalForm
  unp: string | null
  reg_number: string | null
  legal_address: string | null
  director_name: string | null
  verification_status: BusinessVerificationStatus
  verification_notes: string | null
  verified_at: string | null
  is_active: boolean
  subscription_plan: string
}

export interface BusinessStats {
  views_total: number
  views_week: number
  pins_live: number
  pins_total: number
  likes_total: number
  comments_total: number
}

export interface BusinessEarnHint {
  key: string
  title: string
  text: string
}

export interface BusinessDashboard {
  business: BusinessProfile
  stats: BusinessStats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recent_pins: Array<any>
  earn: BusinessEarnHint[]
}

export interface BusinessProfilePayload {
  name: string
  category?: string | null
  legal_form: BusinessLegalForm
  unp?: string | null
  reg_number?: string | null
  address?: string | null
  legal_address?: string | null
  director_name?: string | null
  lat?: number | null
  lng?: number | null
  description?: string | null
  phone?: string | null
  website?: string | null
  working_hours?: Record<string, string> | null
  is_active?: boolean
}
