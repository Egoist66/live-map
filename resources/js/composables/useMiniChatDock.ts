import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { onClickOutside } from '@vueuse/core'
import { useMiniChat } from '@/composables/useMiniChat'
import { useBadgeStore } from '@/stores/badges'
import { avatarSrcFor } from '@/composables/useAvatar'
import type { Conversation } from '@/types/entities/Chat'

/**
 * Логика VK-дока чатов для десктопа: FAB справа снизу, список всех чатов,
 * быстрые мини-окна без захода в /chat.
 *
 * Компонент только отображает, вся механика — здесь: счётчики через
 * realtime-bus (сокет Echo + polling несут одни события), глобальные тосты
 * уже покрыты useAppNotifications, док лишь вшивает превью и историю.
 *
 * @example
 * const dock = useMiniChatDock()
 * await dock.toggleList()
 */
export function useMiniChatDock() {
  const mini = useMiniChat()
  const badges = useBadgeStore()
  const dockRef = ref<HTMLElement | null>(null)

  const isListOpen = computed(() => mini.listOpen.value)
  const windows = computed(() => mini.windows.value)
  const chatRows = computed(() => mini.filtered.value)
  const isListLoading = computed(() => mini.listLoading.value)
  const myId = computed(() => Number(mini.myId.value || 0))
  const searchQuery = computed({
    get: () => mini.query.value,
    set: (next: string) => {
      mini.query.value = next
    },
  })

  /**
   * Бейдж FAB: число чатов с непрочитанным — та же логика,
   * что в колокольчике. Пока список дока не открыт, берём
   * счётчик из глобального стора (тоже по чатам, не по сообщениям).
   */
  const unreadBadge = computed(() => {
    const fromList = Number(mini.unreadTotal.value || 0)
    if (fromList > 0) {
      return fromList
    }
    return Number(badges.unread || 0)
  })

  const unreadLabel = computed(() => {
    const total = unreadBadge.value
    if (total <= 0) {
      return null
    }
    if (total > 99) {
      return '99+'
    }
    return String(total)
  })

  onClickOutside(dockRef, () => {
    const hasWindows = mini.windows.value.length > 0
    if (mini.listOpen.value && !hasWindows) {
      mini.closeList()
    }
  })

  /**
   * Отображаемое имя строки диалога.
   * @param conv диалог из списка
   * @returns имя собеседника или название чата
   */
  function displayName(conv: Conversation): string {
    const directName = conv.other?.name
    if (directName) {
      return directName
    }
    const title = conv.title
    if (title) {
      return title
    }
    return 'Чат'
  }

  /**
   * Аватар строки диалога (ui-avatars fallback внутри).
   * @param conv диалог из списка
   * @returns url аватара
   */
  function avatarFor(conv: Conversation): string {
    if (conv.title) {
      return ''
    }
    return avatarSrcFor(conv.other)
  }

  /**
   * Короткое время превью: сегодня — часы, иначе дата.
   * @param iso дата последнего сообщения
   * @returns строка времени
   */
  function timeOf(iso: string | null): string {
    if (!iso) {
      return ''
    }
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  /**
   * Текст превью последнего сообщения.
   * @param conv диалог из списка
   * @returns обрезанный текст или плейсхолдер вложения
   */
  function previewOf(conv: Conversation): string {
    const body = conv.last_message?.body?.trim()
    if (body) {
      const singleLine = body.replace(/\s+/g, ' ')
      if (singleLine.length > 60) {
        return `${singleLine.slice(0, 60)}…`
      }
      return singleLine
    }
    const hasAttachment = conv.last_message?.attachment != null
    if (hasAttachment) {
      return '📎 Вложение'
    }
    return 'Пока пусто'
  }

  /**
   * Обновить строку поиска по чатам.
   * @param next новый текст поиска
   */
  function setQuery(next: string): void {
    mini.query.value = next ?? ''
  }

  /**
   * Показать/скрыть панель списка, открытие тянет свежие диалоги.
   */
  async function toggleList(): Promise<void> {
    await mini.toggleList()
  }

  function closeList(): void {
    mini.closeList()
  }

  /**
   * Открыть быстрое мини-окно диалога из списка.
   * @param convId id диалога
   */
  async function openChat(convId: number): Promise<void> {
    await mini.openWindow(convId)
  }

  function openAllChats(): void {
    mini.closeList()
    router.visit('/chat')
  }

  return {
    dockRef,
    mini,
    isListOpen,
    windows,
    chatRows,
    isListLoading,
    myId,
    searchQuery,
    unreadBadge,
    unreadLabel,
    displayName,
    avatarFor,
    timeOf,
    previewOf,
    setQuery,
    toggleList,
    closeList,
    openChat,
    openAllChats,
  }
}
