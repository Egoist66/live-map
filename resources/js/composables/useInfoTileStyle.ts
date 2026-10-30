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
  status: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-emerald-500/30 dark:from-rose-500 dark:to-fuchsia-500',
  name: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-violet-500/30 dark:from-rose-500 dark:to-fuchsia-500',
  age: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-orange-500/30 dark:from-rose-500 dark:to-fuchsia-500',
  gender: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-pink-500/30 dark:from-rose-500 dark:to-fuchsia-500',
  city: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-sky-500/30 dark:from-rose-500 dark:to-fuchsia-500',
  bio: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-indigo-500/30 dark:from-rose-500 dark:to-fuchsia-500',
  email: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-cyan-500/30 dark:from-rose-500 dark:to-fuchsia-500',
  home: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-emerald-500/30 dark:from-rose-500 dark:to-fuchsia-500',
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
