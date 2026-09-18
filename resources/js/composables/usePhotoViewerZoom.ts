import { Zoom } from 'swiper/modules'

/**
 * Щипковый зум для Swiper во вьювере UGallery.
 *
 * Модуль `Zoom` разруливает конфликт «свайп слайда vs pinch фото» сам:
 * при масштабе 1 листает фото, увеличенное — двигает пальцем.
 * Даблтап переключает 1x ↔ 3x. Отдельного CSS в Swiper 14 нет,
 * каркас `.swiper-zoom-container` стилизуется во вьювере.
 *
 * @returns модули и опции для `<Swiper>`
 * @example
 * const viewerZoom = usePhotoViewerZoom()
 * // <Swiper :modules="viewerZoom.modules" :zoom="viewerZoom.options">
 */
export function usePhotoViewerZoom() {
  const modules = [Zoom]
  const options = { minRatio: 1, maxRatio: 3, toggle: true }
  return { modules, options }
}
