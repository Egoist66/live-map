import { usePresenceState } from '@/composables/usePresence'

export function useChatOnline(chat: any, friendsApi: any) {
  const { onlineIds, isOnline: presenceOnline, connect, disconnect } = usePresenceState()

  function isInvisibleUser(id: number | string | null | undefined): boolean {
    if (id == null) return false
    const nid = Number(id)
    try {
      const convs = chat?.conversations?.value || []
      for (const c of convs) {
        if (Number(c?.other?.id) === nid && c?.other?.is_invisible) return true
      }
      const active = chat?.activeConv?.value?.other
      if (active && Number(active.id) === nid && active.is_invisible) return true
      const friends = friendsApi?.friends?.value || []
      for (const f of friends) {
        if (Number(f?.other?.id) === nid && (f?.other as any)?.is_invisible) return true
      }
      const results = chat?.searchResults?.value || []
      for (const u of results) {
        if (Number(u?.id) === nid && (u as any)?.is_invisible) return true
      }
    } catch {}
    return false
  }

  const isOnline = (id: number | string | null | undefined) => {
    if (id == null) return false
    if (isInvisibleUser(id)) return false
    return presenceOnline(id)
  }

  return { onlineIds, isOnline, connect, disconnect }
}
