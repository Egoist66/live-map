import { computed } from 'vue'

/**
 * Бейдж онлайна на hero-карточке ULove-профиля.
 *
 * Чужие анкеты — как было: «В сети» или время последнего визита.
 * Своя анкета тоже показывает бейдж («В сети · это вы»), чтобы владелец
 * видел тот же индикатор, что видят другие, а не пустое место.
 *
 * @param getState геттер состояния `{ isOwn, online, lastSeenText }`
 * @returns видимость бейджа, класс точки и текст
 * @example
 * const badge = useUloveOnlineBadge(() => ({ isOwn: props.isOwn, online: props.online, lastSeenText: props.lastSeenText }))
 */
export function useUloveOnlineBadge(getState: () => { isOwn: boolean; online: boolean; lastSeenText: string | null }) {
  const state = computed(() => getState())

  /**
   * Показывать ли бейдж поверх фото.
   */
  const visible = computed(() => {
    if (state.value.isOwn) {
      return true
    }

    return state.value.online || !!state.value.lastSeenText
  })

  /**
   * Зелёная точка — я или собеседник онлайн, серая — оффлайн.
   */
  const isLive = computed(() => {
    if (state.value.isOwn) {
      return true
    }

    return state.value.online
  })

  /**
   * Текст бейджа: свой профиль помечаем «· это вы».
   */
  const text = computed(() => {
    if (state.value.isOwn) {
      return 'В сети · это вы'
    }

    if (state.value.online) {
      return 'В сети'
    }

    return state.value.lastSeenText ?? 'оффлайн'
  })

  return { visible, isLive, text }
}
