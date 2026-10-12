import { shallowRef } from 'vue'

/**
 * Общее состояние видимости диалога AI-ассистента.
 *
 * Состояние живёт на уровне модуля, поэтому открыть гида может
 * любой компонент: `const { openGuide } = useAiGuideLauncher()`.
 */
const isGuideOpen = shallowRef(false)

/**
 * Хук-лаунчер AI-ассистента для layout и страниц.
 *
 * @returns флаг видимости и экшены открытия/закрытия
 * @example
 * const { openGuide } = useAiGuideLauncher()
 * openGuide()
 */
export function useAiGuideLauncher() {
  /**
   * Открыть диалог AI-ассистента.
   */
  function openGuide(): void {
    isGuideOpen.value = true
  }

  /**
   * Закрыть диалог AI-ассистента.
   */
  function closeGuide(): void {
    isGuideOpen.value = false
  }

  return { isGuideOpen, openGuide, closeGuide }
}
