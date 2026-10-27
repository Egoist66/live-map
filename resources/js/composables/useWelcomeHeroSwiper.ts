import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Профиль для hero-слайдера на главной.
 *
 * Поля повторяют анатомию настоящей карточки свайпов
 * (`Swipes.vue`): имя + возраст, цель, город и дистанция,
 * интересы чистыми чипами — чтобы демо на лендинге не
 * диссонировало с реальным продуктом.
 */
export interface WelcomeHeroProfile {
  name: string
  age: number
  photo: string
  /** WebP-версия под контейнер (~560px): в 2–3 раза легче JPG (LCP). */
  photoWebp: string
  /** Ширина WebP для width/height (убирает CLS). */
  photoWidth: number
  /** Высота WebP для width/height (убирает CLS). */
  photoHeight: number
  fallbackPhoto?: string
  /** WebP запасного фото. */
  fallbackPhotoWebp?: string
  goal: string
  city: string
  distance: string
  tags: string[]
}

const AUTOPLAY_DELAY = 3500
const SWIPE_THRESHOLD = 40

/**
 * Hero-слайдер лендинга: профили с автолистанием, точками и свайпом.
 *
 * Вся логика hero-карточки живет здесь, компонент только отображает.
 * @returns профили, активный индекс и обработчики для шаблона
 * @example const hero = useWelcomeHeroSwiper()
 */
export function useWelcomeHeroSwiper() {
  // Фото лендинга — локальные (`public/landing/`): внешние CDN (pravatar,
  // unsplash) давали лишний DNS/TLS-хендшейк, нулевой кэш-контроль и риск
  // «битых лиц» при недоступности чужих хостов. Файлы скачаны 1:1.
  //
  // WebP-двойники (`*-560.webp`, 560px по широкой стороне, q78) — под
  // контейнер hero-карточки (max ~535px): PageSpeed ругался, что 800px JPG
  // больше контейнера, и насчитал 134КБ перевеса на трёх фото. JPG остаётся
  // фолбэком в `<picture>` для древних WebView.
  const profiles = ref<WelcomeHeroProfile[]>([
    {
      name: 'Аня',
      age: 24,
      photo: '/landing/hero-anya.jpg',
      photoWebp: '/landing/hero-anya-560.webp',
      photoWidth: 560,
      photoHeight: 560,
      fallbackPhoto: '/landing/hero-anya-fallback.jpg',
      fallbackPhotoWebp: '/landing/hero-anya-fallback-560.webp',
      goal: 'Серьёзные отношения',
      city: 'Минск',
      distance: '1,2 км',
      tags: ['Кофе и прогулки', 'Кино'],
    },
    {
      name: 'Макс',
      age: 27,
      photo: '/landing/hero-maks.jpg',
      photoWebp: '/landing/hero-maks-560.webp',
      photoWidth: 560,
      photoHeight: 448,
      goal: 'Свидания и общение',
      city: 'Минск',
      distance: '800 м',
      tags: ['Бег по утрам', 'Гитара'],
    },
    {
      name: 'Дима',
      age: 26,
      photo: '/landing/hero-dima.jpg',
      photoWebp: '/landing/hero-dima-560.webp',
      photoWidth: 560,
      photoHeight: 448,
      goal: 'Дружба и общение',
      city: 'Минск',
      distance: '2,1 км',
      tags: ['Футбол с друзьями', 'Игры'],
    },
    {
      name: 'София',
      age: 23,
      photo: '/landing/hero-sofia.jpg',
      photoWebp: '/landing/hero-sofia-560.webp',
      photoWidth: 560,
      photoHeight: 448,
      goal: 'Серьёзные отношения',
      city: 'Минск',
      distance: '1,8 км',
      tags: ['Винные бары', 'Путешествия'],
    },
  ])

  const activeIndex = ref(0)
  const isPaused = ref(false)
  /** Уходящий слайд: гаснет на месте, без прыжка вбок. */
  const leavingIndex = ref<number | null>(null)
  /** Направление последнего перехода: откуда въезжает новый слайд. */
  const direction = ref<1 | -1>(1)

  let timer: ReturnType<typeof setInterval> | null = null
  let touchStartX: number | null = null
  let clearTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Переходит к слайду с нормализацией индекса по кругу.
   *
   * Уходящий слайд только гаснет на месте, въезжающий едет со стороны
   * движения, остальные перекладываются мгновенно (они невидимы).
   * Любой ручной переход перезапускает автоплей — таймер больше
   * не дёргает слайдер сразу после клика по точке.
   *
   * @param index целевой индекс слайда
   * @param dir явное направление (вперёд/назад), иначе по индексам
   */
  function goTo(index: number, dir?: 1 | -1): void {
    const total = profiles.value.length
    const next = ((index % total) + total) % total
    restartAutoplay()
    if (next === activeIndex.value) {
      return
    }
    direction.value = dir ?? (next > activeIndex.value ? 1 : -1)
    leavingIndex.value = activeIndex.value
    activeIndex.value = next
    if (clearTimer !== null) {
      clearTimeout(clearTimer)
    }
    clearTimer = setTimeout(() => {
      leavingIndex.value = null
      clearTimer = null
    }, 550)
  }

  /** Показывает следующий профиль. */
  function goNext(): void {
    goTo(activeIndex.value + 1, 1)
  }

  /** Показывает предыдущий профиль. */
  function goPrev(): void {
    goTo(activeIndex.value - 1, -1)
  }

  /** Останавливает текущий таймер автолистания. */
  function stopAutoplay(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  /** Запускает автолистание профилей. */
  function startAutoplay(): void {
    stopAutoplay()
    timer = setInterval(() => {
      if (!isPaused.value) {
        goNext()
      }
    }, AUTOPLAY_DELAY)
  }

  /** Перезапускает часы автоплея (ручной переход). */
  function restartAutoplay(): void {
    if (timer !== null) {
      startAutoplay()
    }
  }

  /** Ставит автолистание на паузу (наведение мыши). */
  function pause(): void {
    isPaused.value = true
  }

  /** Снимает автолистание с паузы. */
  function resume(): void {
    isPaused.value = false
  }

  /**
   * Запоминает X-координату начала касания для свайпа.
   * @param event событие начала касания
   */
  function onTouchStart(event: TouchEvent): void {
    touchStartX = event.touches[0]?.clientX ?? null
  }

  /**
   * Листает слайды по направлению свайпа.
   * @param event событие конца касания
   */
  function onTouchEnd(event: TouchEvent): void {
    if (touchStartX === null) {
      return
    }
    const endX = event.changedTouches[0]?.clientX ?? touchStartX
    const delta = endX - touchStartX
    touchStartX = null
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      return
    }
    if (delta < 0) {
      goNext()
    } else {
      goPrev()
    }
  }

  /**
   * Подменяет фото на запасное, если основное не загрузилось.
   *
   * `<picture>` сам откатывается с WebP на JPG, сюда доходит только
   * двойной провал — меняем сразу пару (webp + jpg фолбэка).
   *
   * @param profile профиль, чьё фото не загрузилось
   */
  function onPhotoError(profile: WelcomeHeroProfile): void {
    const hasFallback = profile.fallbackPhoto !== undefined
    const isAlreadyFallback = profile.photo === profile.fallbackPhoto

    if (!hasFallback || isAlreadyFallback) {
      return
    }

    profile.photo = profile.fallbackPhoto as string

    if (profile.fallbackPhotoWebp) {
      profile.photoWebp = profile.fallbackPhotoWebp
    }
  }

  /**
   * Возвращает CSS-классы видимости слайда.
   *
   * transition висит только на движущихся слайдах: уходящий гаснет
   * на месте, въезжающий едет со стороны, припаркованные стоят
   * без анимации — клики по точкам больше ничего не дёргают.
   *
   * @param index индекс слайда
   * @returns классы активного, уходящего или припаркованного слайда
   */
  function slideClass(index: number): string {
    if (index === activeIndex.value) {
      return 'opacity-100 translate-x-0 pointer-events-auto z-[1] transition-transform transition-opacity duration-500 ease-out'
    }
    if (index === leavingIndex.value) {
      return 'opacity-0 translate-x-0 pointer-events-none transition-opacity duration-500 ease-out'
    }
    const offscreen = direction.value === 1 ? 'translate-x-8' : '-translate-x-8'
    return `opacity-0 pointer-events-none ${offscreen}`
  }

  onMounted(startAutoplay)
  onUnmounted(() => {
    stopAutoplay()
    if (clearTimer !== null) {
      clearTimeout(clearTimer)
      clearTimer = null
    }
  })

  return {
    profiles,
    activeIndex,
    isPaused,
    goTo,
    goNext,
    goPrev,
    pause,
    resume,
    onPhotoError,
    onTouchStart,
    onTouchEnd,
    slideClass,
  }
}
