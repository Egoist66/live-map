export interface NominatimAddress {
  road?: string
  pedestrian?: string
  footway?: string
  street?: string
  path?: string
  cycleway?: string
  house_number?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  suburb?: string
  neighbourhood?: string
  quarter?: string
  state?: string
  postcode?: string
  country?: string
}

export interface NominatimReverseResponse {
  place_id: number
  display_name: string
  address: NominatimAddress
  lat: string
  lon: string
}

export interface Coords {
  lat: number
  lng: number
}
