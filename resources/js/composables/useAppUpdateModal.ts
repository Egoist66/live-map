import { router } from '@inertiajs/vue3'

/**
 * Маркер версии новости-гида по разделам (бэк: AppModulesWelcomeNews::VERSION).
 */
const MODULES_GUIDE_PREFIX = 'modules-guide'

/**
 * Логика модалки «Что нового» и строк таба «Новости».
 *
 * Компоненты только отображают: форматирование даты, признак гида
 * по разделам и переход в Настройки → Приложение.
 *
 * @example
 * const news = useAppUpdateModal()
 * if (news.isModulesGuide(item)) await news.goModules()
 */
export function useAppUpdateModal() {
  /**
   * Дата новости в человеческом виде.
   *
   * @param iso ISO-дата публикации
   * @returns подпись вида «24 сентября 2026» или пусто
   */
  function fmtDate(iso?: string | null): string {
    if (!iso) {
      return ''
    }

    try {
      return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return ''
    }
  }

  /**
   * Это ли новость-гид по разделам (ей положена кнопка «Открыть разделы»).
   *
   * @param update новость из очереди/истории апдейтов
   * @returns true для гида по модулям
   */
  function isModulesGuide(update: any | null): boolean {
    const version = String(update?.version ?? '')

    return version.startsWith(MODULES_GUIDE_PREFIX)
  }

  /**
   * Вести в Настройки → Приложение → «Разделы приложения».
   *
   * @param afterNavigate опциональный хук (закрыть модалку/колокольчик)
   */
  async function goModules(afterNavigate?: () => void): Promise<void> {
    try {
      afterNavigate?.()
    } catch {
    }

    await router.visit('/settings/app')
  }

  return { fmtDate, isModulesGuide, goModules }
}
