import { computed } from 'vue'
import type { Ref } from 'vue'
import { router } from '@inertiajs/vue3'

/**
 * ULove-тема шапки чата.
 *
 * Строго только для мэтчей: тема активна, когда у собеседника
 * открытого чата `other.is_match === true`. Переключение на обычный
 * диалог сразу возвращает стандартную шапку, ничего не запоминается.
 *
 * @param activeConv активный чат (other несёт is_match, dating_goal)
 * @param selectedId id открытого чата
 * @returns состояние темы и навигация
 */
export function useChatDatingTheme(activeConv: Ref<any>, selectedId: Ref<number | null>) {
  const peer = computed(() => activeConv.value?.other ?? null)

  const isMatch = computed(() => !!peer.value?.is_match)

  /**
   * Тема активна только для открытого чата мэтча.
   * @returns true когда шапка в стиле ULove
   */
  const isDatingEntry = computed(() => !!selectedId.value && isMatch.value)

  const badge = computed(() => {
    if (!isDatingEntry.value || !peer.value) return null
    const goal = goalLabel(peer.value?.dating_goal ?? null)
    return `Мэтч · ${goal}`
  })

  /**
   * Подпись цели знакомства собеседника.
   *
   * @param goal ключ цели
   * @returns человекочитаемая подпись
   */
  function goalLabel(goal: string | null): string {
    const map: Record<string, string> = {
      love: 'Отношения',
      flirt: 'Флирт',
      friendship: 'Дружба',
      chat: 'Общение',
      interests: 'По интересам',
    }
    if (!goal) return 'ULove'
    return map[goal] ?? goal
  }

  /**
   * Чистит query входа из свайпов и старый липкий флаг темы.
   *
   * @returns void
   */
  function checkEntry(): void {
    try {
      window.localStorage.removeItem('ulove-theme')
    } catch { return }
    try {
      if (new URLSearchParams(window.location.search).get('from') === 'swipes') {
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch { return }
  }

  /**
   * Вернуться в ленту свайпов.
   *
   * @returns void
   */
  function backToSwipes(): void {
    router.visit('/swipes')
  }

  return {
    isDatingEntry,
    isMatch,
    badge,
    peer,
    goalLabel,
    checkEntry,
    backToSwipes,
  }
}
