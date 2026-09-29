/**
 * Классы десктопной верхней навигации (AppTopBar, только `lg+`).
 *
 * Активный пункт — фирменный розовый `#F04D9F` + белый текст.
 * В тёмной теме тот же солидный фон, чтобы белый текст читался
 * одинаково в обеих темах. Мобильную навигацию
 * (`MobileBottomNav` + `useMobileBottomNav`) не трогаем — у неё своя
 * схема (розовый текст + тонированная пилюля).
 *
 * Строки классов — полные литералы, чтобы Tailwind JIT увидел их
 * статически (динамическая склейка `bg-[#F0...]` JIT не подхватит).
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
  const activePillClass = 'bg-[#F04D9F] text-white border border-transparent shadow-soft dark:bg-[#F04D9F]'
  const idlePillClass = 'text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white'
  const activeBrandPillClass = 'bg-[#F04D9F] border border-transparent shadow-soft dark:bg-[#F04D9F]'
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
