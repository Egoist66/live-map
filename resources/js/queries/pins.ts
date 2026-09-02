import { defineQueryOptions } from '@pinia/colada'
import { pinsApi } from '@/services/pins.api'

export const PIN_KEYS = {
  all: () => ['pins'] as const,
  nearby: (lat: number, lng: number) => [...PIN_KEYS.all(), 'nearby', lat, lng] as const,
  mine: () => [...PIN_KEYS.all(), 'mine'] as const,
}

export const nearbyPinsQuery = (lat: number, lng: number) =>
  defineQueryOptions({
    key: PIN_KEYS.nearby(lat, lng),
    query: () => pinsApi.list(lat, lng),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  })

export const myPinsQuery = defineQueryOptions({
  key: PIN_KEYS.mine(),
  query: () => pinsApi.mine(),
  staleTime: 30_000,
})
