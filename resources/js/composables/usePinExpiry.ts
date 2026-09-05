export function isPinAlive(p: any, now = Date.now()): boolean {
  if (!p) return false
  if (p.status && p.status !== 'active') return false
  if (!p.expires_at) return false
  return new Date(p.expires_at).getTime() > now
}

export function filterAlivePins<T extends { expires_at?: any; status?: string }>(pins: T[], now = Date.now()): T[] {
  return (pins || []).filter((p) => isPinAlive(p, now))
}

export function usePinExpiry() {
  return { isAlive: isPinAlive, filterAlive: filterAlivePins }
}
