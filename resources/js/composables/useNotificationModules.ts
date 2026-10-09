import { useAppModulesStore, type AppModule } from '@/stores/appModules'

/**
 * Префикс типа уведомления → модуль-владелец.
 *
 * Зеркало бэка (NotificationModuleGate): типы без привязки
 * к отключаемому разделу (чат, ULove, профиль, безопасность,
 * новости, бизнес-аккаунтные) здесь отсутствуют и пропускаются
 * всегда. Бизнес-вердикты нужны владельцам и стаффу независимо
 * от тумблеров — это аккаунтные события, а не контент раздела.
 */
const TYPE_MODULES: ReadonlyArray<readonly [string, AppModule]> = [
  ['pin.', 'upin'],
  ['flow.', 'uflow'],
  ['district.', 'districts'],
  ['sos.', 'upin'],
]

/**
 * Модуль-владелец типа уведомления.
 *
 * @param type тип inbox-строки (dating.liked, pin.commented, …)
 * @returns модуль или null для базовых типов
 */
export function moduleForNotificationType(type: unknown): AppModule | null {
  const prefix = String(type ?? '')

  if (prefix === '') {
    return null
  }

  for (const [needle, module] of TYPE_MODULES) {
    if (prefix.startsWith(needle)) {
      return module
    }
  }

  return null
}

/**
 * Гейт уведомлений по включённым разделам.
 *
 * Только ULove — летят лишь базовые (ULove, чат, профиль,
 * безопасность, новости); выпустил карту/ленту/районы —
 * плюсуются их семьи. Компоненты только отображают.
 *
 * @returns проверка типа перед тостом/вставкой в ленту
 * @example if (!notifyModules.allows(n.type)) return
 */
export function useNotificationModules() {
  const modules = useAppModulesStore()

  /**
   * Можно ли показать уведомление текущего набора разделов.
   *
   * @param type тип inbox-строки
   * @returns true для базовых типов и включённых разделов
   */
  function allows(type: unknown): boolean {
    const module = moduleForNotificationType(type)

    if (module === null) {
      return true
    }

    try {
      return modules.isEnabled(module)
    } catch {
      return true
    }
  }

  return { allows, moduleForNotificationType }
}
