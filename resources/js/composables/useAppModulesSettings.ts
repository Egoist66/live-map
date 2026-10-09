import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { ALL_MODULES, MODULE_HOME, MODULE_META, useAppModulesStore, type AppModule } from '@/stores/appModules'

/**
 * Догрузка чанка модуля: страница тянет за собой фичи и стор
 * (manualChunks `mod-*`), после резолва раздел работает сразу,
 * без докачки при первом переходе.
 */
const MODULE_PRELOADERS: Record<AppModule, () => Promise<unknown>> = {
  ulove: () => import('@/Pages/Swipes.vue'),
  upin: () => import('@/Pages/Map/Index.vue'),
  uflow: () => import('@/Pages/Flow/Index.vue'),
  districts: () => import('@/Pages/Districts/Index.vue'),
  business: () => import('@/Pages/Business/Index.vue'),
}

/**
 * Кэши кода и данных приложения (не трогаем шрифты/тайлы/картинки).
 */
const APP_CACHE_PREFIXES = ['pwa-build', 'pwa-pages', 'pwa-api']

/**
 * Строка секции «Разделы приложения» в настройках.
 */
export interface ModuleRow {
  /** id модуля */
  id: AppModule
  /** подпись */
  label: string
  /** иконка primeicons */
  icon: string
  /** пояснение */
  desc: string
  /** стартовый путь */
  home: string
  /** включён ли */
  enabled: boolean
  /** стартовый ли экран */
  isPrimary: boolean
}

/**
 * Логика секции «Разделы приложения» (настройки → Приложение).
 *
 * Компонент только отображает строки и дёргает toggle/makePrimary.
 * Последний включённый раздел выключить нельзя — стор игнорирует.
 *
 * @returns строки разделов, флаги и действия
 * @example const m = useAppModulesSettings()
 */
export function useAppModulesSettings() {
  const page = usePage()
  const store = useAppModulesStore()

  try {
    const globalRaw = (page.props as unknown as { globalModules?: unknown }).globalModules

    if (globalRaw !== undefined) {
      store.applyGlobal(globalRaw)
    }

    store.ensureInit((page.props as any)?.auth?.user ?? null)
  } catch {
  }

  const rows = computed<ModuleRow[]>(() =>
    ALL_MODULES.filter((id) => store.isGloballyEnabled(id)).map((id) => ({
      id,
      label: MODULE_META[id].label,
      icon: MODULE_META[id].icon,
      desc: MODULE_META[id].desc,
      home: MODULE_HOME[id],
      enabled: store.isEnabled(id),
      isPrimary: store.primary === id && store.isEnabled(id),
    })),
  )

  /** Только ULove доступен глобально: остальные разделы ещё не выпущены патчем. */
  const onlyUlove = computed(() => rows.value.length <= 1)

  const legacy = computed(() => !store.isIsolated)

  const saving = computed(() => store.saving)
  const error = computed(() => store.error)
  const busy = ref<Record<AppModule, boolean>>({ ulove: false, upin: false, uflow: false, districts: false, business: false })

  /**
   * Догружает чанк модуля, чтобы раздел заработал сразу.
   *
   * @param id включённый модуль
   */
  async function preloadModule(id: AppModule): Promise<void> {
    try {
      await MODULE_PRELOADERS[id]()
    } catch {
    }
  }

  /**
   * Чистит кэши кода и данных приложения перед перезагрузкой.
   */
  async function clearAppCaches(): Promise<void> {
    try {
      if (typeof caches === 'undefined') {
        return
      }

      const names = await caches.keys()

      await Promise.all(
        names
          .filter((name) => APP_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
          .map((name) => caches.delete(name).catch(() => false)),
      )
    } catch {
    }
  }

  /**
   * Переключает раздел (не даёт выключить последний).
   *
   * Включение догружает чанк модуля — функциональность доступна
   * сразу. Выключение перезагружает приложение начисто: только
   * включённые модули плюс очищенные кэши кода.
   *
   * @param id модуль-переключатель
   */
  async function toggle(id: AppModule): Promise<void> {
    if (busy.value[id]) {
      return
    }

    if (!store.isGloballyEnabled(id)) {
      return
    }

    const wasEnabled = store.isEnabled(id)
    busy.value[id] = true

    try {
      await store.toggle(id)
    } catch {
      busy.value[id] = false
      return
    }

    if (!wasEnabled) {
      await preloadModule(id)
      busy.value[id] = false
      return
    }

    await clearAppCaches()

    try {
      window.location.reload()
    } catch {
      busy.value[id] = false
    }
  }

  /**
   * Делает раздел стартовым экраном после входа.
   *
   * Выключенный раздел сначала включается, потом становится первым.
   *
   * @param id модуль-стартовый
   */
  async function makePrimary(id: AppModule): Promise<void> {
    if (!store.isGloballyEnabled(id)) {
      return
    }

    try {
      await store.setPrimary(id)
    } catch {
    }
  }

  return { rows, onlyUlove, legacy, saving, error, busy, toggle, makePrimary }
}
