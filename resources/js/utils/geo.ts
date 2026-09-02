export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function inBoundingBox(lat: number, lng: number, centerLat: number, centerLng: number, radiusKm: number): boolean {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180))
  return lat >= centerLat - latDelta && lat <= centerLat + latDelta && lng >= centerLng - lngDelta && lng <= centerLng + lngDelta
}
