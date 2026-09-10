import { ref, computed } from 'vue'

export type ChatRowTarget =
  | { kind: 'chat'; id: number; userId?: number; userName?: string }
  | { kind: 'friend'; friendship: any; other?: any; userId?: number; userName?: string }

/**
 * Контекстное меню строки в списке чатов (⋯): десктоп — попап, мобилка — bottom-sheet.
 * @param actions колбэки действий над чатом / другом
 * @returns состояние меню и модель пунктов PrimeVue Menu
 */
export function useChatRowMenu(actions: {
  onDeleteChat: (id: number) => void
  onBlock: (id: number, name?: string) => void
  onRemoveFriend: (f: any) => void
  onStartChat: (u: any) => void
}) {
  const menu = ref<any>(null)
  const sheetOpen = ref(false)
  const target = ref<ChatRowTarget | null>(null)

  const isMobileView = () => {
    try {
      return window.innerWidth < 640
    } catch {
      return false
    }
  }

  /**
   * Открывает меню для строки списка.
   * @param e событие клика
   * @param t цель меню (чат или друг)
   */
  function open(e: Event, t: ChatRowTarget): void {
    target.value = t
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
    try {
      menu.value?.hide()
    } catch {}
  }

  /**
   * Выполняет действие пункта и закрывает меню.
   * @param fn действие пункта
   */
  function run(fn: () => void): void {
    close()
    fn()
  }

  const menuModel = computed(() => {
    const t = target.value
    if (!t) return []
    if (t.kind === 'chat') {
      const items: any[] = [
        { label: 'Удалить чат', icon: 'pi pi-trash', danger: true, class: 'danger-item !text-red-600', command: () => run(() => actions.onDeleteChat(t.id)) },
      ]
      if (t.userId) {
        items.push({ label: 'Заблокировать', icon: 'pi pi-ban', danger: true, class: 'danger-item !text-red-600', command: () => run(() => actions.onBlock(t.userId as number, t.userName)) })
      }
      return items
    }
    const items: any[] = [
      { label: 'Написать', icon: 'pi pi-comments', command: () => run(() => actions.onStartChat(t.other ?? { id: t.userId })) },
      { label: 'Удалить из друзей', icon: 'pi pi-user-minus', danger: true, class: 'danger-item !text-red-600', command: () => run(() => actions.onRemoveFriend(t.friendship)) },
    ]
    if (t.userId) {
      items.push({ label: 'Заблокировать', icon: 'pi pi-ban', danger: true, class: 'danger-item !text-red-600', command: () => run(() => actions.onBlock(t.userId as number, t.userName)) })
    }
    return items
  })

  return { menu, sheetOpen, target, menuModel, open, close, run }
}
