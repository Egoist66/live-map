import { computed, ref } from 'vue'
import axios from 'axios'
import { ALL_MODULES, MODULE_META, useAppModulesStore, type AppModule } from '@/stores/appModules'

/**
 * Строка глобального тумблера модуля в админке.
 */
export interface AdminModuleRow {
  /** id модуля */
  id: AppModule
  /** подпись */
  label: string
  /** иконка primeicons */
  icon: string
  /** пояснение */
  desc: string
  /** включён ли глобально */
  enabled: boolean
  /** заблокирован ли (ULove выключить нельзя) */
  locked: boolean
}

/**
 * Глобальные модули приложения (админка → Модули).
 *
 * Админ включает разделы глобально отдельными патчами. Только после
 * этого пользователи видят тумблеры этих разделов в настройках
 * «Приложение» и могут включать у себя. ULove включён всегда.
 * Чанки выключенных разделов клиент не грузит — меньше нагрузка.
 *
 * @returns строки модулей, флаги и действия
 * @example const adminModules = useAdminModules(); await adminModules.load()
 */
export function useAdminModules() {
  const store = useAppModulesStore()

  const loading = ref(false)
  const saving = ref<string | null>(null)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  const rows = computed<AdminModuleRow[]>(() =>
    ALL_MODULES.map((id) => ({
      id,
      label: MODULE_META[id].label,
      icon: MODULE_META[id].icon,
      desc: MODULE_META[id].desc,
      enabled: store.isGloballyEnabled(id),
      locked: id === 'ulove',
    })),
  )

  /**
   * Загрузить глобальный набор с сервера и положить в стор.
   */
  async function load(): Promise<void> {
    if (loading.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await axios.get('/api/admin/modules')
      const fresh = response.data?.global_modules

      if (Array.isArray(fresh)) {
        store.applyGlobal(fresh)
      }

      loaded.value = true
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      error.value = e.response?.data?.message ?? 'Не удалось загрузить модули'
    } finally {
      loading.value = false
    }
  }

  /**
   * Переключить модуль глобально (кроме locked ULove).
   *
   * @param id модуль-переключатель
   */
  async function toggle(id: AppModule): Promise<void> {
    if (id === 'ulove' || saving.value) {
      return
    }

    const current = [...store.globalEnabled]
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]

    saving.value = id
    error.value = null

    try {
      const response = await axios.put('/api/admin/modules', { modules: next })
      const fresh = response.data?.global_modules

      if (Array.isArray(fresh)) {
        store.applyGlobal(fresh)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      error.value = e.response?.data?.message ?? 'Не удалось сохранить модули'
    } finally {
      saving.value = null
    }
  }

  return { rows, loading, saving, error, loaded, load, toggle }
}
