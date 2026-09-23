import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SwipeCard } from '@/services/dating.api'

/**
 * Листание фото кандидата прямо на свайп-карточке.
 *
 * В ленте ULove видно до 5 фото всем: анкета держит 5,
 * все 5 листаются и без PRO.
 * По умолчанию фото сами листаются каждые 5 секунд и останавливаются на последнем.
 * Индекс и таймер сбрасываются при смене карточки и ручном переходе.
 * Горизонтальный свайп по фото (`dragStart/dragMove/dragEnd`) листает
 * вперёд/назад с живой тянучкой (`photoStyle`): порог 60px, вертикальный
 * жест игноится, тапы (`tapUp`) после свайпа не срабатывают сами
 * (сдвиг > 12px — уже не тап).
 * Смена кадра идёт через staged swap: старое фото висит, пока новое
 * грузится (`shownPhoto`), затем въезжает слайдом по `slideDir`;
 * лоадер (`showPhotoLoader`) — только если грузка дольше 250мс,
 * кэшированные кадры меняются без мигания.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useSwipeCardPhotos } from '@/composables/useSwipeCardPhotos'
 * const cardPhotos = useSwipeCardPhotos(() => s.current.value)
 * </script>
 * ```
 *
 * @param card геттер текущей карточки
 * @param autoplayMs интервал автолистания в мс, по умолчанию 5000
 * @returns фото, индекс и действия листания
 */
export function useSwipeCardPhotos(card: () => SwipeCard | null, autoplayMs = 5000) {
  const photoIndex = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  let downX = 0
  let downY = 0
  let downAt = 0

  const photos = computed(() => {
    const list = card()?.photos ?? []
    return list.slice(0, 5)
  })

  const total = computed(() => photos.value.length)
  const currentPhoto = computed(() => photos.value[photoIndex.value] ?? null)
  const hasPhotos = computed(() => total.value > 0)
  const hasMultiple = computed(() => total.value > 1)

  /** Фактически показанный кадр (старый висит, пока новый грузится). */
  const shownPhoto = ref<string | null>(null)
  /** Направление последнего перехода: 1 — вперёд, -1 — назад, 0 — fade. */
  const slideDir = ref<0 | 1 | -1>(0)
  /** Видимый лоадер: только долгая загрузка, кэш — без мигания. */
  const showPhotoLoader = ref(false)
  let loadToken = 0
  let loaderTimer: ReturnType<typeof setTimeout> | null = null
  const neighborCache: HTMLImageElement[] = []

  /** Порог горизонтального свайпа для листания фото (px). */
  const PHOTO_SWIPE_PX = 60
  /** Предел живой тянучки фото за пальцем (px). */
  const PHOTO_DRAG_MAX_PX = 160

  /** Живое смещение фото за пальцем во время свайпа. */
  const dragOffset = ref(0)
  /** Идёт ли сейчас свайп (тянучка без transition). */
  const dragging = ref(false)
  let dragAnchorX = 0
  let dragAnchorY = 0
  let dragLastY = 0

  /**
   * Стиль фото: во время свайпа едет за пальцем без transition,
   * после — плавный возврат. Смена фото идёт через key, поэтому
   * висящий transition ничему не мешает.
   */
  const photoStyle = computed(() => {
    if (dragging.value) {
      return { transform: `translateX(${dragOffset.value}px)`, transition: 'none' }
    }
    return { transform: 'translateX(0px)', transition: 'transform 0.25s ease' }
  })

  /**
   * Перейти к конкретному фото по полоске, таймер начинается заново.
   * @param at индекс фото
   */
  function goTo(at: number): void {
    if (at < 0 || at >= total.value) {
      return
    }
    if (at > photoIndex.value) {
      slideDir.value = 1
    } else if (at < photoIndex.value) {
      slideDir.value = -1
    } else {
      slideDir.value = 0
    }
    photoIndex.value = at
    restartAutoplay()
  }

  /**
   * Следующее фото, стоп на последнем.
   */
  function next(): void {
    if (photoIndex.value < total.value - 1) {
      slideDir.value = 1
      photoIndex.value += 1
      restartAutoplay()
    }
  }

  /**
   * Предыдущее фото, стоп на первом.
   */
  function prev(): void {
    if (photoIndex.value > 0) {
      slideDir.value = -1
      photoIndex.value -= 1
      restartAutoplay()
    }
  }

  /**
   * Запомнить точку нажатия для отличия тапа от свайпа.
   * @param e событие нажатия
   */
  function tapDown(e: PointerEvent): void {
    downX = e.clientX
    downY = e.clientY
    downAt = Date.now()
  }

  /**
   * Тап по фото как в сторис: левая треть — назад, остальное — вперёд.
   * Свайпы и клики по кнопкам не трогает. Вызывать на pointerup оверлея.
   * @param e событие отпускания
   * @returns true если это был тап по фото
   */
  function tapUp(e: PointerEvent): boolean {
    try {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('button, a')) {
        return false
      }
      const dx = e.clientX - downX
      const dy = e.clientY - downY
      if (Math.hypot(dx, dy) > 12 || Date.now() - downAt > 500) {
        return false
      }
      const host = e.currentTarget as HTMLElement | null
      const rect = host?.getBoundingClientRect?.()
      if (!rect || rect.width <= 0) {
        return false
      }
      if ((e.clientX - rect.left) / rect.width < 0.3) {
        prev()
      } else {
        next()
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Сбросить на первое фото (при смене карточки).
   */
  function reset(): void {
    slideDir.value = 0
    photoIndex.value = 0
  }

  /**
   * Гасит отложенный показ лоадера.
   */
  function disarmLoader(): void {
    if (loaderTimer) {
      clearTimeout(loaderTimer)
      loaderTimer = null
    }
  }

  /**
   * Показывает лоадер, только если кадр грузится дольше 250мс.
   *
   * @param token токен текущей загрузки
   */
  function armLoader(token: number): void {
    disarmLoader()
    if (typeof window === 'undefined') {
      return
    }
    loaderTimer = setTimeout(() => {
      if (token === loadToken) {
        showPhotoLoader.value = true
      }
    }, 250)
  }

  /**
   * Греет соседние кадры, чтобы свайп туда был мгновенным.
   */
  function preloadNeighbors(): void {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return
    }
    const current = photoIndex.value
    const upcoming = [photos.value[current + 1], photos.value[current - 1]]
    for (const src of upcoming) {
      if (src && src !== shownPhoto.value) {
        const probe = new Image()
        probe.src = src
        neighborCache.push(probe)
      }
    }
    while (neighborCache.length > 4) {
      neighborCache.shift()
    }
  }

  /**
   * Staged swap: старое фото остаётся на экране, новый кадр грузится
   * в фоне и подменяет его готовым. Ошибка загрузки тоже подменяет —
   * лучше битая картинка, чем вечный спиннер на старом кадре.
   *
   * @param src целевой кадр (null — пусто)
   * @param dir направление въезда
   */
  function stagePhoto(src: string | null, dir: 0 | 1 | -1): void {
    slideDir.value = dir
    const token = ++loadToken
    disarmLoader()
    showPhotoLoader.value = false
    if (!src) {
      shownPhoto.value = null
      return
    }
    if (src === shownPhoto.value) {
      return
    }
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      shownPhoto.value = src
      return
    }
    armLoader(token)
    const probe = new Image()
    const done = () => {
      if (token !== loadToken) {
        return
      }
      disarmLoader()
      showPhotoLoader.value = false
      shownPhoto.value = src
      preloadNeighbors()
    }
    probe.onload = done
    probe.onerror = done
    probe.src = src
  }

  /**
   * Начало свайпа по фото: запоминаем якорь и притормаживаем автолистание,
   * чтобы таймер не сменил кадр прямо под пальцем.
   *
   * @param e событие нажатия
   */
  function dragStart(e: PointerEvent): void {
    if (total.value < 2) {
      return
    }
    dragging.value = true
    dragAnchorX = e.clientX
    dragAnchorY = e.clientY
    dragLastY = e.clientY
    dragOffset.value = 0
    restartAutoplay()
  }

  /**
   * Тянучка фото за пальцем, вертикаль скролла страницы не трогаем.
   *
   * @param e событие движения
   */
  function dragMove(e: PointerEvent): void {
    if (!dragging.value) {
      return
    }
    dragLastY = e.clientY
    const shiftX = e.clientX - dragAnchorX
    dragOffset.value = Math.max(-PHOTO_DRAG_MAX_PX, Math.min(PHOTO_DRAG_MAX_PX, shiftX))
  }

  /**
   * Конец свайпа: резкий горизонтальный бросок листает фото,
   * преимущественно вертикальный жест — отмена без листания.
   */
  function dragEnd(): void {
    if (!dragging.value) {
      return
    }
    dragging.value = false
    const shiftX = dragOffset.value
    const shiftY = dragLastY - dragAnchorY
    dragOffset.value = 0
    if (Math.abs(shiftY) > Math.abs(shiftX)) {
      return
    }
    if (shiftX <= -PHOTO_SWIPE_PX) {
      next()
      return
    }
    if (shiftX >= PHOTO_SWIPE_PX) {
      prev()
    }
  }

  /**
   * Обрыв свайпа (палец ушёл с фото, отмена жеста): сброс без листания.
   */
  function dragCancel(): void {
    dragging.value = false
    dragOffset.value = 0
  }

  /**
   * Остановить автолистание.
   */
  function stopAutoplay(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  /**
   * Запустить автолистание заново: каждые N секунд следующее фото, стоп на последнем.
   */
  function restartAutoplay(): void {
    stopAutoplay()
    if (total.value < 2) {
      return
    }
    timer = setInterval(() => {
      if (photoIndex.value >= total.value - 1) {
        stopAutoplay()
        return
      }
      slideDir.value = 1
      photoIndex.value += 1
    }, autoplayMs)
  }

  watch(
    () => card()?.id,
    () => {
      reset()
      restartAutoplay()
    },
  )

  watch([photoIndex, photos], ([index, list]) => {
    stagePhoto(list[index] ?? null, slideDir.value)
  }, { immediate: true })

  onMounted(() => restartAutoplay())
  onBeforeUnmount(() => {
    loadToken += 1
    disarmLoader()
    stopAutoplay()
  })

  return { photos, total, photoIndex, currentPhoto, shownPhoto, slideDir, showPhotoLoader, hasPhotos, hasMultiple, intervalMs: autoplayMs, dragOffset, dragging, photoStyle, goTo, next, prev, reset, restartAutoplay, stopAutoplay, tapDown, tapUp, dragStart, dragMove, dragEnd, dragCancel }
}
