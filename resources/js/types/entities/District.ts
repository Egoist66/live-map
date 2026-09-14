/**
 * UDistrict — свой район-заливка на карте.
 */
export type DistrictRole = 'owner' | 'member' | 'pending' | 'guest'

/**
 * Интерес островка.
 */
export type DistrictInterest =
  | 'neighbors'
  | 'sport'
  | 'music'
  | 'pets'
  | 'kids'
  | 'food'
  | 'study'
  | 'games'
  | 'art'
  | 'help'

/**
 * GeoJSON MultiPolygon заливки кисти.
 */
export interface DistrictGeometry {
  type: 'MultiPolygon'
  coordinates: Array<Array<Array<[number, number]>>>
}

/**
 * Короткая карточка района для слоя карты и списка.
 */
export interface District {
  id: number
  name: string
  interest: DistrictInterest | string
  geometry: DistrictGeometry
  center_lat: number
  center_lng: number
  owner: { id: number; name: string; avatar_url: string | null } | null
  members_count: number
  role: DistrictRole
  conversation_id: number | null
  created_at?: string | null
}

/**
 * Полная карточка для диалога деталей.
 */
export interface DistrictDetails extends District {
  description: string | null
  pins: any[]
  pins_locked: boolean
  pins_count: number
}

/**
 * Житель или заявка района.
 */
export interface DistrictResident {
  id: number
  name: string
  avatar_url: string | null
  since?: string | null
  is_owner?: boolean
}

/**
 * Пейлоад создания района из заливки кисти.
 */
export interface CreateDistrictPayload {
  name: string
  description?: string | null
  interest?: string
  geometry: DistrictGeometry
  /** Живая геопозиция автора: зона считается от неё, как фиолетовый круг */
  user_lat?: number | null
  user_lng?: number | null
}
