import { usePresenceState, isRecentlySeen } from '@/composables/usePresence'

export function useChatOnline(chat: any, friendsApi: any) {
  const { onlineIds, isOnline: presenceOnline, connect, disconnect } = usePresenceState()

  function lookupUser(id: number | string): any | null {
    const nid = Number(id)
    try {
      const active = chat?.activeConv?.value?.other
      if (active && Number(active.id) === nid) return active
      for (const c of chat?.conversations?.value || []) {
        if (Number(c?.other?.id) === nid) return c.other
      }
      for (const f of friendsApi?.friends?.value || []) {
        if (Number(f?.other?.id) === nid) return f.other
      }
      for (const r of friendsApi?.pendingIn?.value || []) {
        if (Number(r?.requester?.id) === nid) return r.requester
      }
      for (const u of chat?.searchResults?.value || []) {
        if (Number(u?.id) === nid) return u
      }
    } catch {}
    return null
  }

  const isOnline = (id: number | string | null | undefined, lastSeenAt?: string | null) => {
    if (id == null) return false
    const u = lookupUser(id)
    if (u?.is_invisible) return false
    if (presenceOnline(id)) return true
    const seen = lastSeenAt ?? u?.last_seen_at ?? null
    return isRecentlySeen(seen)
  }

  return { onlineIds, isOnline, connect, disconnect }
}
