import { h, type VNode } from 'vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import GuestLayout from '@/Layouts/GuestLayout.vue'

/**
 * Страницы без лейаута (полностью свои обёртки).
 */
const LAYOUTLESS_PAGES = new Set(['Welcome', 'Maintenance'])

interface PageChildProps {
  auth?: { user?: unknown }
}

/**
 * Назначает странице персистентный лейаут для Inertia.
 *
 * Без этого каждая страница монтирует свой лейаут из шаблона —
 * дерево целиком пересоздаётся при навигации и `<Transition>`
 * в лейауте никогда не видит смену страниц (анимаций нет).
 * С персистентным лейаутом оболочка живёт между визитами,
 * меняется только контент — переходы играют.
 *
 * Лейаут выбирается по факту авторизации из пропсов страницы:
 * гостям — `GuestLayout`, своим — `AuthenticatedLayout`.
 * Функция-лейаут вызывается Inertia при каждом рендере, так что
 * смена гость→юзер (логин) корректно перемонтирует оболочку.
 * Уже назначенный странице `layout` не трогаем.
 *
 * @param name имя Inertia-страницы (например `'Map/Index'`)
 * @param component компонент страницы из `resolvePageComponent`
 * @example
 * const module = await resolvePageComponent(`./Pages/${name}.vue`, pages)
 * applyPersistentLayout(name, module.default)
 * return module
 */
export function applyPersistentLayout(name: string, component: any): void {
  if (!component || component.layout || LAYOUTLESS_PAGES.has(name)) {
    return
  }

  component.layout = (createElement: typeof h, child: VNode) => {
    const props = (child.props ?? {}) as PageChildProps
    const Layout = props.auth?.user ? AuthenticatedLayout : GuestLayout

    return createElement(Layout, () => child)
  }
}
