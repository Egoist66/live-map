import { Zoom } from 'swiper/modules'

/**
 * Щипковый зум для Swiper во вьювере UGallery.
 *
 * Модуль `Zoom` разруливает конфликт «свайп слайда vs pinch фото» сам:
 * при масштабе 1 листает фото, увеличенное — двигает пальцем.
 * Даблтап переключает 1x ↔ 3x. Без `enabled: true` модуль молча
 * не работает — ни pinch, ни даблтап (баг «зума нет»).
 * Отдельного CSS в Swiper 14 нет, каркас `.swiper-zoom-container`
 * стилизуется во вьювере.
 *
 * @returns модули и опции для `<Swiper>`
 * @example
 * const viewerZoom = usePhotoViewerZoom()
 * // <Swiper :modules="viewerZoom.modules" :zoom="viewerZoom.options">
 */
export function usePhotoViewerZoom() {
  const modules = [Zoom]
  const options = { enabled: true, minRatio: 1, maxRatio: 3, toggle: true }
  return { modules, options }
}
