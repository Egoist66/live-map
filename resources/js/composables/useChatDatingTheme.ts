import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { router } from '@inertiajs/vue3'

/**
 * Дейтинг-тема чата при переходе из свайпов.
 *
 * Вход фиксируется по ?from=swipes в URL: шапка чата
 * окрашивается в тему знакомств, виден бейдж мэтча/цели
 * и кнопка возврата в ленту. При смене чата тема гаснет.
 *
 * @param activeConv активный чат (other несёт is_match, dating_goal)
 * @param selectedId id открытого чата
 * @returns состояние темы и навигация
 */
export function useChatDatingTheme(activeConv: Ref<any>, selectedId: Ref<number | null>) {
  const entryConvId = ref<number | null>(null)
  const enteredFromSwipes = ref(false)

  try {
    enteredFromSwipes.value = new URLSearchParams(window.location.search).get('from') === 'swipes'
  } catch {
    enteredFromSwipes.value = false
  }

  const isDatingEntry = computed(() => entryConvId.value !== null && selectedId.value === entryConvId.value)

  const peer = computed(() => activeConv.value?.other ?? null)

  const isMatch = computed(() => !!peer.value?.is_match)

  const badge = computed(() => {
    if (!isDatingEntry.value || !peer.value) return null
    const goal = goalLabel(peer.value?.dating_goal ?? null)
    if (isMatch.value) return `Мэтч · ${goal}`
    return `Со свайпов · ${goal}`
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
   * Зафиксировать вход из свайпов и почистить query.
   *
   * @returns void
   */
  function checkEntry(): void {
    if (enteredFromSwipes.value && selectedId.value && entryConvId.value === null) {
      entryConvId.value = selectedId.value
      enteredFromSwipes.value = false
    }
    try {
      if (new URLSearchParams(window.location.search).get('from') === 'swipes') {
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch {
      return
    }
  }

  /**
   * Вернуться в ленту свайпов.
   *
   * @returns void
   */
  function backToSwipes(): void {
    router.visit('/swipes')
  }

  watch(selectedId, (id) => {
    if (id === null) {
      entryConvId.value = null
      return
    }
    if (enteredFromSwipes.value && entryConvId.value === null) {
      entryConvId.value = id
      enteredFromSwipes.value = false
      try {
        window.history.replaceState({}, '', window.location.pathname)
      } catch {
        return
      }
    }
  })

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
