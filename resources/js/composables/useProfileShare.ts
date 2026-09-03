import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'

export function useProfileShare() {
  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const sharing = ref(false)
  const copied = ref(false)

  function getUrl(userId: number | string) {
    try {
      if (typeof route !== 'undefined' && route().has('users.show')) return route('users.show', userId as any)
    } catch {}
    return `${window.location.origin}/users/${userId}`
  }

  async function shareProfile(user: { id: number | string; name?: string }) {
    sharing.value = true
    const url = getUrl(user.id)
    const title = user.name ? `Профиль ${user.name} — UPin` : 'Профиль — UPin'
    const text = user.name ? `Посмотри профиль ${user.name} на UPin` : 'Посмотри профиль на UPin'
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        toast?.add({ severity: 'success', summary: 'Поделились', detail: 'Ссылка отправлена', life: 2500 })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        copied.value = true
        toast?.add({ severity: 'success', summary: 'Скопировано', detail: url, life: 3000 })
        setTimeout(() => (copied.value = false), 2000)
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        toast?.add({ severity: 'success', summary: 'Скопировано', detail: url, life: 3000 })
      }
      return url
    } catch (e: any) {
      if (e?.name === 'AbortError') return url
      try {
        await navigator.clipboard.writeText(url)
        toast?.add({ severity: 'success', summary: 'Скопировано', detail: url, life: 3000 })
      } catch {
        toast?.add({ severity: 'info', summary: 'Ссылка', detail: url, life: 4000 })
        prompt('Скопируйте ссылку:', url)
      }
      return url
    } finally {
      sharing.value = false
    }
  }

  return { sharing, copied, shareProfile, getUrl }
}
