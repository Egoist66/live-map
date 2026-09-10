import { ref, computed } from 'vue'
import { useProfileShare } from '@/composables/useProfileShare'
import { useToast } from 'primevue/usetoast'

export type ProfileMenuTarget = {
  id: number | string
  name?: string
}

/**
 * Адаптивное меню профиля (⋯): десктоп — попап, мобилка — bottom-sheet.
 * @returns состояние меню и действия поделиться/скопировать
 */
export function useProfileMenu() {
  const menu = ref<any>(null)
  const sheetOpen = ref(false)
  const target = ref<ProfileMenuTarget | null>(null)
  const { shareProfile, getUrl, sharing } = useProfileShare()
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const isMobileView = () => {
    try {
      return window.innerWidth < 640
    } catch {
      return false
    }
  }

  /**
   * Открывает меню для пользователя.
   * @param e событие клика
   * @param user целевой пользователь
   */
  function open(e: Event, user: ProfileMenuTarget): void {
    target.value = user
    if (isMobileView()) {
      sheetOpen.value = true
      return
    }
    try {
      menu.value?.toggle(e)
    } catch {
      sheetOpen.value = true
    }
  }

  function close(): void {
    sheetOpen.value = false
  }

  /**
   * Делится профилем через Web Share / буфер.
   */
  async function share(): Promise<void> {
    if (!target.value) return
    close()
    await shareProfile({ id: target.value.id, name: target.value.name })
  }

  /**
   * Копирует ссылку на профиль.
   */
  async function copyLink(): Promise<void> {
    if (!target.value) return
    const url = getUrl(target.value.id)
    close()
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast?.add({ severity: 'success', summary: 'Скопировано', detail: url, life: 2500 })
    } catch {
      toast?.add({ severity: 'info', summary: 'Ссылка', detail: url, life: 4000 })
    }
  }

  const menuModel = computed(() => [
    { label: 'Поделиться профилем', icon: 'pi pi-share-alt', command: () => share() },
    { label: 'Скопировать ссылку', icon: 'pi pi-link', command: () => copyLink() },
  ])

  return { menu, sheetOpen, target, sharing, menuModel, open, close, share, copyLink }
}
