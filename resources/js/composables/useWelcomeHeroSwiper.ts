import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Профиль для hero-слайдера на главной.
 */
export interface WelcomeHeroProfile {
  name: string
  age: number
  photo: string
  fallbackPhoto?: string
  distance: string
  pin: string
  tags: string[]
}

const AUTOPLAY_DELAY = 3500
const SWIPE_THRESHOLD = 40

/**
 * Hero-слайдер лендинга: два профиля с автолистанием и свайпом.
 *
 * Вся логика hero-карточки живет здесь, компонент только отображает.
 * @returns профили, активный индекс и обработчики для шаблона
 * @example const hero = useWelcomeHeroSwiper()
 */
export function useWelcomeHeroSwiper() {
  // Фото лендинга — локальные (`public/landing/`): внешние CDN (pravatar,
  // unsplash) давали лишний DNS/TLS-хендшейк, нулевой кэш-контроль и риск
  // «битых лиц» при недоступности чужих хостов. Файлы скачаны 1:1.
  const profiles = ref<WelcomeHeroProfile[]>([
    {
      name: 'Аня',
      age: 24,
      photo: '/landing/hero-anya.jpg',
      fallbackPhoto: '/landing/hero-anya-fallback.jpg',
      distance: '● РЯДОМ · 1,2 км',
      pin: '📍 пин рядом',
      tags: ['☕ кофе и прогулки', '🎬 кино'],
    },
    {
      name: 'Макс',
      age: 27,
      photo: '/landing/hero-maks.jpg',
      distance: '● РЯДОМ · 800 м',
      pin: '📍 пин рядом',
      tags: ['🏃 бег по утрам', '🎸 гитара'],
    },
    {
      name: 'Дима',
      age: 26,
      photo: '/landing/hero-dima.jpg',
      distance: '● РЯДОМ · 2,1 км',
      pin: '📍 пин рядом',
      tags: ['⚽ футбол с друзьями', '🎮 игры'],
    },
    {
      name: 'София',
      age: 23,
      photo: '/landing/hero-sofia.jpg',
      distance: '● РЯДОМ · 1,8 км',
      pin: '📍 пин рядом',
      tags: ['🍷 винные бары', '✈️ путешествия'],
    },
  ])

  const activeIndex = ref(0)
  const isPaused = ref(false)

  let timer: ReturnType<typeof setInterval> | null = null
  let touchStartX: number | null = null

  /**
   * Переходит к слайду с нормализацией индекса по кругу.
   * @param index целевой индекс слайда
   */
  function goTo(index: number): void {
    const total = profiles.value.length
    activeIndex.value = ((index % total) + total) % total
  }

  /** Показывает следующий профиль. */
  function goNext(): void {
    goTo(activeIndex.value + 1)
  }

  /** Показывает предыдущий профиль. */
  function goPrev(): void {
    goTo(activeIndex.value - 1)
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
   * @param profile профиль, чьё фото не загрузилось
   */
  function onPhotoError(profile: WelcomeHeroProfile): void {
    if (profile.fallbackPhoto && profile.photo !== profile.fallbackPhoto) {
      profile.photo = profile.fallbackPhoto
    }
  }

  /**
   * Возвращает CSS-классы видимости слайда.
   * @param index индекс слайда
   * @returns классы активного или скрытого слайда
   */
  function slideClass(index: number): string {
    if (index === activeIndex.value) {
      return 'opacity-100 translate-x-0 pointer-events-auto z-[1]'
    }
    const direction = index > activeIndex.value ? 'translate-x-8' : '-translate-x-8'
    return `opacity-0 pointer-events-none ${direction}`
  }

  onMounted(startAutoplay)
  onUnmounted(stopAutoplay)

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
