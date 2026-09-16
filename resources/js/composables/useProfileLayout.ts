import { computed, ref } from 'vue'

/**
 * Выбор колонок профиля: 'one' — лента, 'two' — сайдбар + лента.
 * Дефолт — две колонки. Работает на всех ширинах, включая мобайл.
 */
export type ProfileColumns = 'one' | 'two'

/** Ключ сохранённого выбора колонок в localStorage. */
const COLUMNS_KEY = 'live-map:profile-columns'

/**
 * Читает сохранённый выбор колонок.
 *
 * @returns 'one' — принудительно одна колонка, иначе 'two'
 */
function readColumns(): ProfileColumns {
  try {
    if (localStorage.getItem(COLUMNS_KEY) === 'one') return 'one'
  } catch {}
  return 'two'
}

/**
 * Общий выбор на всё приложение: один ref на модуль делят настройки
 * и обе страницы профиля, поэтому переключение видно везде сразу.
 */
const sharedColumns = ref<ProfileColumns>(readColumns())

/** Слушатель кросс-таб синхронизации вешается один раз. */
let storageBound = false

/**
 * Подтягивает выбор из другой вкладки того же браузера.
 * Внутри одной вкладки все уже синхронны через общий ref.
 */
function bindCrossTabSync(): void {
  if (storageBound) return
  storageBound = true
  try {
    window.addEventListener('storage', (event) => {
      if (!event.key || event.key === COLUMNS_KEY) sharedColumns.value = readColumns()
    })
  } catch {}
}
/**
 * Выбор раскладки профиля. Меняется в настройках оформления
 * (`SettingsAppearanceTab`), страницы профиля только читают итог.
 *
 * Устроено без медиа-запросов в JS специально:
 * - сетка включается чистым CSS (`lg:`), десктоп получает две колонки,
 *   когда выбор — 'two';
 * - ряд-плитка «Профиль · Друзья · Поиск» и меню-сайдбар
 *   переключаются выбором, а не шириной экрана:
 *   'one' — плитка везде, 'two' — сайдбар везде.
 *
 * @returns выбор, флаг одной колонки, опции и подсказка для настроек
 * @example
 * const layout = useProfileLayout()
 * layout.selectColumns('one')
 */
export function useProfileLayout() {
  bindCrossTabSync()
  const single = computed<boolean>(() => sharedColumns.value === 'one')

  const columnOptions = [
    { v: 'one' as const, label: 'Одна колонка', icon: 'pi pi-list' },
    { v: 'two' as const, label: 'Две колонки', icon: 'pi pi-th-large' },
  ]

  const columnsHint = computed<string>(() =>
    single.value ? 'Профиль лентой в одну колонку' : 'Сайдбар + лента',
  )

  /**
   * Сохраняет выбор колонок. Применяется сразу (реактивно) и переживает
   * перезагрузку. Работает на всех ширинах, включая мобайл.
   *
   * @param next 'one' — одна колонка, 'two' — две
   */
  function selectColumns(next: ProfileColumns): void {
    sharedColumns.value = next
    try {
      localStorage.setItem(COLUMNS_KEY, next)
    } catch {}
  }

  return { columns: sharedColumns, single, columnOptions, columnsHint, selectColumns }
}
