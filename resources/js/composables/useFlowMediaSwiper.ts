import { ref, watch } from 'vue'

/** Минимальный инстанс Swiper: полный тип тянет конфликтующие модули, в проекте принят any-стиль. */
type FlowSwiper = {
  activeIndex?: number
  slideTo: (index: number, speed?: number) => void
  update: () => void
}

/**
 * Свайп-логика для каруселей UFlow (просмотр поста и превью композера).
 *
 * Компонент только отображает `<Swiper>`, весь индекс/навигация/сброс — здесь.
 * Работает и на мобилке (тач), и на десктопе (drag мышью + клавиатура).
 *
 * @param count геттер числа слайдов — при уменьшении индекс поджимается
 * @returns инстанс свайпера, активный индекс и действия навигации
 *
 * @example
 * const carousel = useFlowMediaSwiper(() => media.length)
 * // <Swiper @swiper="carousel.register" @slideChange="carousel.onSlideChange">
 */
export function useFlowMediaSwiper(count: () => number) {
  const swiper = ref<FlowSwiper | null>(null)
  const index = ref(0)

  /**
   * Запомнить инстанс Swiper для кнопок-стрелок и точек.
   * @param instance инстанс из события `@swiper`
   */
  function register(instance: FlowSwiper): void {
    swiper.value = instance
    clamp()
  }

  /**
   * Синхронизировать точки/счётчик при свайпе.
   * @param instance инстанс из события `@slideChange`
   */
  function onSlideChange(instance: FlowSwiper): void {
    const total = count()
    const next = instance.activeIndex ?? 0

    index.value = Math.min(Math.max(0, next), Math.max(0, total - 1))
  }

  /**
   * Перейти к слайду по точке/счётчику.
   * @param target целевой индекс
   */
  function go(target: number): void {
    const total = count()

    if (target < 0 || target >= total) {
      return
    }

    index.value = target
    swiper.value?.slideTo(target)
  }

  /** Следующий слайд (стрелка вправо). */
  function next(): void {
    go(index.value + 1)
  }

  /** Предыдущий слайд (стрелка влево). */
  function prev(): void {
    go(index.value - 1)
  }

  /**
   * Поджать индекс если слайды удалили (превью композера),
   * свайпер дотягивается сам без анимации.
   */
  function clamp(): void {
    const total = count()

    if (total <= 0) {
      index.value = 0
      return
    }

    if (index.value > total - 1) {
      index.value = total - 1
      swiper.value?.slideTo(index.value, 0)
    }
  }

  watch(count, () => {
    clamp()
    swiper.value?.update()
  })

  return { swiper, index, register, onSlideChange, go, next, prev }
}
