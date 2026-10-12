import { shallowRef } from 'vue'
import { router } from '@inertiajs/vue3'
import { useAiEnabled } from '@/composables/useAiEnabled'
import { useAiGuideLauncher } from '@/composables/useAiGuideLauncher'
import { useMiniChatDock } from '@/composables/useMiniChatDock'

/**
 * Общая видимость панели виджетов (мини-чат + AI).
 *
 * Состояние живёт на уровне модуля: один лаунчер на весь layout,
 * открыть/закрыть панель может любой компонент.
 */
const isPanelOpen = shallowRef(false)

/**
 * Хук панели плавающих виджетов для layout.
 *
 * @returns флаг панели, бейдж непрочитанных и экшены
 * @example
 * const { isPanelOpen, togglePanel } = useFloatingWidgets()
 */
export function useFloatingWidgets() {
  const dock = useMiniChatDock()
  const { openGuide } = useAiGuideLauncher()

  /**
   * Переключить панель виджетов.
   */
  function togglePanel(): void {
    isPanelOpen.value = !isPanelOpen.value
  }

  /**
   * Закрыть панель виджетов.
   */
  function closePanel(): void {
    isPanelOpen.value = false
  }

  /**
   * Открыть сообщения: на десктопе — всплывающий список дока,
   * на мобиле — полная страница чатов.
   */
  async function openMessages(): Promise<void> {
    closePanel()

    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

    if (isDesktop) {
      await dock.toggleList()
      return
    }

    router.visit('/chat')
  }

  /**
   * Открыть AI-гида и спрятать панель.
   * Молча игнорируется, если ИИ выключен для зрителя.
   */
  function openAssistant(): void {
    closePanel()
    try {
      if (!useAiEnabled().canSeeAi.value) return
    } catch {
      // SSR без Inertia-пропсов — открываем как раньше.
    }
    openGuide()
  }

  return { isPanelOpen, unreadLabel: dock.unreadLabel, isListOpen: dock.isListOpen, togglePanel, closePanel, openMessages, openAssistant }
}
