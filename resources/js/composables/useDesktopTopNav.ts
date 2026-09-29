/**
 * Классы десктопной верхней навигации (AppTopBar, только `lg+`).
 *
 * Активный пункт — фирменный тиндеровский розовый `#FD267D` + белый
 * текст. В тёмной теме фон с небольшой прозрачностью (`/80`), чтобы
 * белый текст читался на тёмной подложке. Мобильную навигацию
 * (`MobileBottomNav` + `useMobileBottomNav`) не трогаем — у неё своя
 * схема (розовый текст + тонированная пилюля).
 *
 * Строки классов — полные литералы, чтобы Tailwind JIT увидел их
 * статически (динамическая склейка `bg-[#FD...]` JIT не подхватит).
 *
 * @example
 * ```ts
 * const { topNavPillClass, topNavBrandPillClass } = useDesktopTopNav()
 * // :class="['px-4 py-1.5 rounded-full ...', topNavPillClass(route().current('map'))]"
 * ```
 *
 * @returns классы активной/неактивной пилюли и хелперы
 */
export function useDesktopTopNav() {
  const activePillClass = 'bg-[#FD267D] text-white border border-transparent shadow-soft dark:bg-[#FD267D]/80'
  const idlePillClass = 'text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white'
  const activeBrandPillClass = 'bg-[#FD267D] border border-transparent shadow-soft dark:bg-[#FD267D]/80'
  const idleBrandPillClass = 'hover:text-ink-900'

  /**
   * Класс обычной пилюли (Кабинет, Карта, Чат).
   *
   * @param isActive активен ли пункт
   * @returns строка классов для `:class`
   */
  function topNavPillClass(isActive: boolean): string {
    return isActive ? activePillClass : idlePillClass
  }

  /**
   * Класс родительской пилюли бренд-пунктов (ULove, UFlow).
   *
   * Текст живёт во внутреннем `span`: активный — `!text-white`,
   * неактивный — градиентный (остаётся в шаблоне без изменений).
   *
   * @param isActive активен ли пункт
   * @returns строка классов для `:class`
   */
  function topNavBrandPillClass(isActive: boolean): string {
    return isActive ? activeBrandPillClass : idleBrandPillClass
  }

  return { activePillClass, idlePillClass, activeBrandPillClass, idleBrandPillClass, topNavPillClass, topNavBrandPillClass }
}
