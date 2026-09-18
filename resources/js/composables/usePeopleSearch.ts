import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { chatApi } from '@/services/chat.api'
import { usePresenceState, isRecentlySeen } from '@/composables/usePresence'

export function usePeopleSearch() {
  const open = ref(false)
  const query = ref('')
  const results = ref<any[]>([])
  const searching = ref(false)
  const creating = ref(false)
  let timer: any = null

  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const confirm = (() => { try { return useConfirm() } catch { return null as any } })()
  const { isOnline: presenceOnline } = usePresenceState()

  function isOnline(id?: number | null, lastSeenAt?: string | null): boolean {
    if (id == null) return false
    const u = results.value.find((x) => Number(x?.id) === Number(id))
    if (u?.is_invisible) return false
    if (presenceOnline(id)) return true
    return isRecentlySeen(lastSeenAt ?? u?.last_seen_at ?? null)
  }

  function openDialog() {
    open.value = true
  }

  function closeDialog() {
    open.value = false
    if (timer) clearTimeout(timer)
  }

  function setQuery(v: string) {
    query.value = v
    const q = v.trim()
    if (q.length < 2) {
      results.value = []
      searching.value = false
      if (timer) clearTimeout(timer)
      return
    }
    if (timer) clearTimeout(timer)
    searching.value = true
    timer = setTimeout(async () => {
      try {
        const res = await chatApi.search(q)
        const nested = (res as { data?: unknown })?.data
        results.value = Array.isArray(res) ? res : (Array.isArray(nested) ? nested : [])
      } catch {
        results.value = []
      } finally {
        searching.value = false
      }
    }, 300)
  }

  async function startChat(u: any) {
    if (u?.can_message === false) {
      toast?.add({ severity: 'warn', summary: 'Нельзя написать', detail: u?.can_message_reason || 'Пользователь не принимает сообщения', life: 3500 })
      return
    }
    creating.value = true
    try {
      const res = await chatApi.createConversation(u.id)
      closeDialog()
      router.visit(`/chat/${res.id}`)
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: e?.response?.data?.message || 'Не удалось создать чат', life: 3500 })
    } finally {
      creating.value = false
    }
  }

  async function addFriend(userId: number) {
    try {
      await chatApi.addFriend(userId)
      const item = results.value.find((u: any) => Number(u?.id) === Number(userId))
      if (item) item.is_pending = true
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: e?.response?.data?.message || 'Не удалось отправить заявку', life: 3500 })
    }
  }

  function askBlock(userId: number, name?: string) {
    if (!confirm) return
    confirm.require({
      header: 'Заблокировать?',
      message: `Заблокировать ${name ?? 'пользователя'}? Чат и дружба будут удалены, сообщения скрыты.`,
      icon: 'pi pi-ban',
      acceptLabel: 'Заблокировать',
      rejectLabel: 'Отмена',
      accept: async () => {
        try {
          await chatApi.block(userId)
          results.value = results.value.filter((u: any) => Number(u?.id) !== Number(userId))
        } catch (e: any) {
          toast?.add({ severity: 'error', summary: 'Ошибка', detail: e?.response?.data?.message || 'Не удалось заблокировать', life: 3500 })
        }
      },
    })
  }

  return { open, query, results, searching, creating, isOnline, openDialog, closeDialog, setQuery, startChat, addFriend, askBlock }
}
