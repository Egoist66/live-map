import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { router } from '@inertiajs/vue3'

const STORAGE_KEY = 'ulove-theme'

/**
 * ULove-тема шапки чата.
 *
 * Включается один раз при входе из свайпов (?from=swipes) и
 * для любого чата мэтча (other.is_match), дальше не сбрасывается
 * при переключении диалогов: все мэтчи выглядят одинаково.
 *
 * @param activeConv активный чат (other несёт is_match, dating_goal)
 * @param selectedId id открытого чата
 * @returns состояние темы и навигация
 */
export function useChatDatingTheme(activeConv: Ref<any>, selectedId: Ref<number | null>) {
  const enteredFromSwipes = ref(false)
  const pinned = ref(false)

  try {
    enteredFromSwipes.value = new URLSearchParams(window.location.search).get('from') === 'swipes'
    pinned.value = window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    enteredFromSwipes.value = false
  }

  const peer = computed(() => activeConv.value?.other ?? null)

  const isMatch = computed(() => !!peer.value?.is_match)

  /**
   * Тема активна для мэтча или после входа из ULove.
   * @returns true когда шапка в стиле ULove
   */
  const isDatingEntry = computed(() => {
    if (!selectedId.value) return false
    return isMatch.value || pinned.value || enteredFromSwipes.value
  })

  const badge = computed(() => {
    if (!isDatingEntry.value || !peer.value) return null
    const goal = goalLabel(peer.value?.dating_goal ?? null)
    if (isMatch.value) return `Мэтч · ${goal}`
    return `ULove · ${goal}`
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

  /** Запомнить ULove-вход и почистить query. */
  function remember(): void {
    pinned.value = true
    enteredFromSwipes.value = false
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch { return }
    try {
      if (new URLSearchParams(window.location.search).get('from') === 'swipes') {
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch { return }
  }

  /**
   * Зафиксировать вход из свайпов и почистить query.
   *
   * @returns void
   */
  function checkEntry(): void {
    if (enteredFromSwipes.value && selectedId.value) remember()
    else {
      try {
        if (new URLSearchParams(window.location.search).get('from') === 'swipes') {
          window.history.replaceState({}, '', window.location.pathname)
        }
      } catch { return }
    }
    if (isMatch.value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
        pinned.value = true
      } catch { return }
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
    if (id === null) return
    if (enteredFromSwipes.value) remember()
    if (isMatch.value && !pinned.value) {
      pinned.value = true
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
      } catch { return }
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
