import type { PinActivityItem } from '@/services/pinActivity.api'

/**
 * Миниатюры сущностей для колокольчика: фото/пост рядом с аватаром автора.
 *
 * Слева в строке всегда аватар актора, справа — картинка сущности
 * (фото профиля или картинка поста UFlow), если она есть в пейлоаде.
 * Старые строки без url/image_url тихо пропускаются без миниатюры.
 *
 * @example
 * const media = useNotificationMedia()
 * // <img v-if="media.entityImage(a)" :src="media.entityImage(a)" />
 */
export function useNotificationMedia() {
  /**
   * Достать картинку сущности из активности.
   *
   * @param a элемент ленты уведомлений
   * @returns url миниатюры или null
   */
  function entityImage(a: PinActivityItem): string | null {
    const photoUrl = (a as PinActivityItem).photo?.url
    if (typeof photoUrl === 'string' && photoUrl.length > 0) {
      return photoUrl
    }
    const flowImage = (a as PinActivityItem).flow_post?.image_url
    if (typeof flowImage === 'string' && flowImage.length > 0) {
      return flowImage
    }
    return null
  }

  return { entityImage }
}
