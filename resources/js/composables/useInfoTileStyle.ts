/**
 * Цветные градиентные иконки для секции «Общая информация».
 *
 * Выносит все классы плиток из компонентов, чтобы `*.vue`
 * отвечали только за отображение (Правило №1).
 *
 * @returns классы плиток и функция цвета иконки по типу поля
 * @example
 * const tiles = useInfoTileStyle()
 * // <span :class="tiles.iconFor('city')"><i class="pi pi-map-marker" /></span>
 */
export type InfoTileKind =
  | 'status'
  | 'name'
  | 'age'
  | 'gender'
  | 'city'
  | 'bio'
  | 'email'
  | 'home'

const tileCls =
  'w-full flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-100/70 px-3 py-3 text-left transition hover:bg-stone-100 active:scale-[0.99] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'

const rowCls =
  'flex items-center gap-3 p-3 rounded-3xl bg-stone-50 border min-w-0 dark:bg-white/[0.03] dark:border-white/10'

const iconBase =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl border-0 text-base text-white shadow-md'

const labelCls = 'block text-xs text-stone-500 dark:text-zinc-500'

const valueCls = 'block truncate text-sm font-bold text-ink-900 dark:text-zinc-100'

const chevronCls = 'pi pi-chevron-right shrink-0 text-xs text-stone-300 dark:text-zinc-600'

const iconVariants: Record<InfoTileKind, string> = {
  status: 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/30 dark:from-emerald-500 dark:to-teal-600',
  name: 'bg-gradient-to-br from-violet-500 to-purple-700 shadow-violet-500/30 dark:from-violet-500 dark:to-purple-600',
  age: 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-orange-500/30 dark:from-amber-500 dark:to-orange-600',
  gender: 'bg-gradient-to-br from-pink-400 to-rose-600 shadow-pink-500/30 dark:from-pink-500 dark:to-rose-600',
  city: 'bg-gradient-to-br from-sky-400 to-blue-600 shadow-sky-500/30 dark:from-sky-500 dark:to-blue-600',
  bio: 'bg-gradient-to-br from-indigo-400 to-violet-600 shadow-indigo-500/30 dark:from-indigo-500 dark:to-violet-600',
  email: 'bg-gradient-to-br from-cyan-400 to-sky-600 shadow-cyan-500/30 dark:from-cyan-500 dark:to-sky-600',
  home: 'bg-gradient-to-br from-lime-400 to-emerald-600 shadow-emerald-500/30 dark:from-lime-500 dark:to-emerald-600',
}

export function useInfoTileStyle() {
  /**
   * Возвращает классы цветной иконки для типа поля.
   * @param kind тип плитки (status, name, age, gender, city, bio, email, home)
   * @returns строка классов Tailwind с градиентом
   */
  function iconFor(kind: InfoTileKind): string {
    const variant = iconVariants[kind] ?? iconVariants.bio
    return `${iconBase} ${variant}`
  }

  /**
   * Динамическая иконка пола: мужская / женская / нейтральная.
   * @param gender сырое значение пола ('male' | 'female' | 'other' | null)
   * @returns класс иконки PrimeIcons
   * @example
   * const icon = tiles.genderIconFor('female') // 'pi pi-venus'
   */
  function genderIconFor(gender: string | null | undefined): string {
    if (gender === 'male') return 'pi pi-mars'
    if (gender === 'female') return 'pi pi-venus'
    return 'pi pi-users'
  }

  return { tileCls, rowCls, iconBase, iconFor, genderIconFor, labelCls, valueCls, chevronCls }
}
