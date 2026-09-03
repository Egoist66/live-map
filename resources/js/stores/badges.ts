import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatApi } from '@/services/chat.api'

export const useBadgeStore = defineStore('badges', () => {
  const unread = ref(0)
  const pending = ref(0)
  const loading = ref(false)
  let echoCh: any = null
  let inited = false

  const total = computed(() => unread.value + pending.value)

  async function fetch() {
    try {
      const w = window as any
      const convsPromise = w.__conversationsInflight ? w.__conversationsInflight : chatApi.conversations().catch(() => [] as any[])
      const [convs, fr] = await Promise.all([
        convsPromise,
        chatApi.friendships().catch(() => ({ pending_in: [] } as any)),
      ])
      unread.value = (convs as any[]).reduce((s: number, c: any) => s + (c.unread_count || 0), 0)
      pending.value = (fr.pending_in?.length || 0)
    } catch {}
  }

  function subscribe() {
    try {
      const echo = (window as any).Echo
      if (!echo) return
      const uid = (window as any).userId || document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (!uid) return
      if (echoCh) return
      echoCh = echo.private(`user.${uid}`)
      echoCh.listen('.message.sent', () => { unread.value += 1 })
      echoCh.listen('.message.updated', () => fetch())
      echoCh.listen('.message.deleted', () => fetch())
      echoCh.listen('.friendship.updated', (e: any) => {
        const f = e.friendship
        const myId = Number(uid)
        if (f?.status === 'pending' && Number(f.addressee_id) === myId) pending.value += 1
        else fetch()
      })
      echoCh.listen('.message.read', () => fetch())
      const pusher = (echo as any).connector?.pusher
      if (pusher) {
        pusher.connection.bind('connected', () => fetch())
      }
    } catch {}
  }

  function setUnread(v: number) { unread.value = v }
  function setPending(v: number) { pending.value = v }
  function decUnread() { unread.value = Math.max(0, unread.value - 1) }
  function incUnread() { unread.value += 1 }
  function incPending() { pending.value += 1 }
  function decPending() { pending.value = Math.max(0, pending.value - 1) }

  async function init() {
    if (inited) return
    inited = true
    loading.value = true
    await fetch()
    subscribe()
    loading.value = false
    window.addEventListener('focus', fetch)
  }

  function refresh() { return fetch() }

  return { unread, pending, total, loading, init, fetch, refresh, subscribe, setUnread, setPending, decUnread, incUnread, incPending, decPending }
})
