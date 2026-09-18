import { ref } from 'vue'

/**
 * Фото для полноэкранного лайтбокса.
 */
export interface LightboxPhoto {
  /** Прямая ссылка на картинку. */
  src: string
  /** Подпись/alt. */
  alt?: string
}

/**
 * Состояние полноэкранного просмотра фото (посты, новости).
 *
 * Сам лайтбокс — `PhotoLightbox`, здесь только какие фото открыты.
 * Один инстанс на карточку: `openSingle()` для постов с одним фото.
 *
 * @returns фото, индекс, флаг открытия и действия
 * @example
 * const lightbox = usePhotoLightbox()
 * lightbox.openSingle(post.image_url, 'Фото поста')
 */
export function usePhotoLightbox() {
  const photos = ref<LightboxPhoto[]>([])
  const index = ref(0)
  const open = ref(false)

  /**
   * Открыть несколько фото с позиции.
   *
   * @param items фото
   * @param startIndex стартовая позиция
   */
  function openPhotos(items: LightboxPhoto[], startIndex = 0): void {
    if (!items.length) {
      return
    }
    photos.value = items
    const last = items.length - 1
    index.value = Math.min(Math.max(0, startIndex), last)
    open.value = true
  }

  /**
   * Открыть одно фото.
   *
   * @param src ссылка на картинку
   * @param alt подпись
   */
  function openSingle(src: string, alt = 'Фото'): void {
    if (!src) {
      return
    }
    openPhotos([{ src, alt }], 0)
  }

  /**
   * Закрыть просмотр.
   */
  function close(): void {
    open.value = false
  }

  return { photos, index, open, openPhotos, openSingle, close }
}
