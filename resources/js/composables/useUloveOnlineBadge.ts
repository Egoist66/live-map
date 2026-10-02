import { computed } from 'vue'

/**
 * Бейдж онлайна на hero-карточке ULove-профиля.
 *
 * Чужие анкеты — как было: «В сети» или время последнего визита.
 * Своя анкета тоже показывает бейдж («В сети · это вы»), чтобы владелец
 * видел тот же индикатор, что видят другие, а не пустое место.
 * Своя анкета с активной невидимкой — «🕵️ Невидимка · это вы»
 * с серой точкой вместо зелёной.
 *
 * @param getState геттер состояния `{ isOwn, online, lastSeenText, invisible }`
 * @returns видимость бейджа, класс точки и текст
 * @example
 * const badge = useUloveOnlineBadge(() => ({ isOwn: props.isOwn, online: props.online, lastSeenText: props.lastSeenText, invisible: props.isOwn && !!props.profileUser?.is_invisible }))
 */
export function useUloveOnlineBadge(getState: () => { isOwn: boolean; online: boolean; lastSeenText: string | null; invisible?: boolean }) {
  const state = computed(() => getState())
  const invisibleActive = computed(() => state.value.isOwn && !!state.value.invisible)

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
   * Зелёная точка — я или собеседник онлайн, серая — оффлайн/невидимка.
   */
  const isLive = computed(() => {
    if (invisibleActive.value) {
      return false
    }

    if (state.value.isOwn) {
      return true
    }

    return state.value.online
  })

  /**
   * Текст бейджа: свой профиль помечаем «· это вы», невидимку — явно.
   */
  const text = computed(() => {
    if (invisibleActive.value) {
      return '🕵️ Невидимка · это вы'
    }

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
