import { computed, type Ref } from 'vue'

/**
 * Штампы LIKE / NOPE на карточке свайпов в стиле Tinder.
 *
 * Проявляются при перетаскивании: вправо — зелёный LIKE,
 * влево — красный NOPE. Чистая презентация поверх dragX из useSwipes.
 *
 * @param dragX горизонтальное смещение перетаскивания из useSwipes
 * @returns стили штампов для :style
 * @example const stamps = useSwipeStamps(s.dragX)
 */
export function useSwipeStamps(dragX: Ref<number>) {
  const likeOpacity = computed(() => {
    const ratio = dragX.value / 90

    if (ratio <= 0) {
      return 0
    }

    return Math.min(ratio, 1)
  })

  const nopeOpacity = computed(() => {
    const ratio = -dragX.value / 90

    if (ratio <= 0) {
      return 0
    }

    return Math.min(ratio, 1)
  })

  const likeStyle = computed(() => ({
    opacity: String(likeOpacity.value),
    transform: `rotate(-20deg) scale(${0.8 + likeOpacity.value * 0.2})`,
  }))

  const nopeStyle = computed(() => ({
    opacity: String(nopeOpacity.value),
    transform: `rotate(20deg) scale(${0.8 + nopeOpacity.value * 0.2})`,
  }))

  return { likeOpacity, nopeOpacity, likeStyle, nopeStyle }
}
