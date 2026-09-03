import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const onlineIds = ref<Set<number>>(new Set())
let channel: any = null
let started = false

function getEcho(): any {
  return (window as any).Echo
}

function isInvisible(): boolean {
  try {
    const u = (window as any)?.__inertia_page?.props?.auth?.user ?? (document as any)?.__page_auth_user
    if (u?.is_invisible) return true
  } catch {}
  try {
    const el = document.querySelector('[data-page]')?.getAttribute('data-page')
    if (el) {
      const page = JSON.parse(el)
      if (page?.props?.auth?.user?.is_invisible) return true
    }
  } catch {}
  return false
}

function connect() {
  if (started) return
  if (isInvisible()) return
  const echo = getEcho()
  if (!echo || typeof echo.join !== 'function') return
  try {
    started = true
    channel = echo.join('online')
      .here((users: any[]) => {
        const ids = users.map((u: any) => Number(u.id ?? u))
        onlineIds.value = new Set(ids)
      })
      .joining((user: any) => {
        const id = Number(user.id ?? user)
        const s = new Set(onlineIds.value)
        s.add(id)
        onlineIds.value = s
      })
      .leaving((user: any) => {
        const id = Number(user.id ?? user)
        const s = new Set(onlineIds.value)
        s.delete(id)
        onlineIds.value = s
      })
      .error((e: any) => console.warn('[presence] error', e))
  } catch (e) {
    console.warn('[presence] join failed', e)
    started = false
  }
}

function disconnect() {
  try {
    const echo = getEcho()
    if (echo && channel) echo.leave('online')
  } catch {}
  channel = null
  started = false
}

export function usePresence() {
  onMounted(() => connect())
  onBeforeUnmount(() => {})

  const isOnline = (id: number | string | null | undefined) => {
    if (id == null) return false
    return onlineIds.value.has(Number(id))
  }

  return {
    onlineIds: computed(() => onlineIds.value),
    isOnline,
    connect,
    disconnect,
  }
}

export function usePresenceState() {
  return {
    onlineIds: computed(() => onlineIds.value),
    isOnline: (id: number | string | null | undefined) => onlineIds.value.has(Number(id)),
    connect,
    disconnect,
  }
}
