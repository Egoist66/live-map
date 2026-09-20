import { ref } from 'vue'
import { useStorage } from '@vueuse/core'

/**
 * Ключ флага «промо анонимных лайков уже показано» в localStorage.
 */
export const ANON_LIKE_PROMO_KEY = 'live-map:anon-like-promo-seen'

/**
 * Промо анонимных лайков: показывается один раз при первом лайке.
 *
 * Механика: пользователь ставит первый лайк фото в галерее — показываем
 * красивое уведомление, что лайкать можно анонимно («Тайный поклонник»),
 * но для этого нужен тариф PRO. PRO-пользователям не показываем.
 *
 * @returns видимость промо и действия для неё
 * @example
 * const promo = useAnonymousLikePromo()
 * promo.maybeShowOnFirstLike({ liked: true, canIncognito: false })
 */
export function useAnonymousLikePromo() {
  const seen = useStorage(ANON_LIKE_PROMO_KEY, false)
  const visible = ref(false)

  /**
   * Показать промо при первом успешном лайке (не PRO).
   *
   * @param input liked — лайк поставлен (не снят); canIncognito — у юзера уже есть PRO
   */
  function maybeShowOnFirstLike(input: { liked: boolean; canIncognito: boolean }): void {
    if (!input.liked) {
      return
    }
    if (input.canIncognito) {
      seen.value = true
      return
    }
    if (seen.value) {
      return
    }
    seen.value = true
    visible.value = true
  }

  /** Закрыть промо. */
  function close(): void {
    visible.value = false
  }

  return { promoVisible: visible, maybeShowOnFirstLike, closePromo: close }
}
