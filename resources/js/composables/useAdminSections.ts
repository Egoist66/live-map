import { defineAsyncComponent, type Component } from 'vue'
import AdminSectionError from '@/Components/Features/Admin/AdminSectionError.vue'
import AdminSectionSkeleton from '@/Components/Features/Admin/AdminSectionSkeleton.vue'

/**
 * Ленивые секции консоли: каждый тяжёлый таб — отдельный чанк.
 *
 * Раньше `Pages/Admin/Index.vue` статически импортировал все менеджеры:
 * один упавший чанк (stale-импорт после деплоя, битый модуль) ронял
 * ВЕСЬ рендер панели и отравлял инстанс — белый экран и на «назад».
 * Теперь ядро (статистика/онлайн/топбар/сайдбар) едет сразу, а табы
 * догружаются по требованию: падение изолировано в секции с кнопками
 * «Повторить» / «Обновить страницу».
 *
 * @returns карта таб-менеджеров как асинхронных компонентов
 * @example
 * ```vue
 * <script setup lang="ts">
 * const sections = useAdminSections()
 * </script>
 * <template>
 *   <component :is="sections.users" :list="users" />
 * </template>
 * ```
 */
export function useAdminSections(): Record<string, Component> {
  /**
   * Обернуть менеджер таба в асинхронный компонент с едиными состояниями.
   *
   * @param loader динамический импорт менеджера
   * @returns компонент секции с скелетом и плашкой ошибки
   */
  function section(loader: () => Promise<unknown>): Component {
    return defineAsyncComponent({
      loader: loader as () => Promise<Component>,
      loadingComponent: AdminSectionSkeleton,
      errorComponent: AdminSectionError,
      delay: 200,
      timeout: 30000,
    })
  }

  return {
    users: section(() => import('@/Components/Features/Admin/AdminUsersManager.vue')),
    business: section(() => import('@/Components/Features/Admin/AdminBusinessManager.vue')),
    updates: section(() => import('@/Components/Features/Admin/AdminUpdatesManager.vue')),
    impersonateLogs: section(() => import('@/Components/Features/Admin/AdminImpersonationLogs.vue')),
    loginAttempts: section(() => import('@/Components/Features/Admin/AdminLoginAttempts.vue')),
    maintenance: section(() => import('@/Components/Features/Admin/AdminMaintenanceManager.vue')),
    modules: section(() => import('@/Components/Features/Admin/AdminModulesManager.vue')),
    payments: section(() => import('@/Components/Features/Admin/AdminPaymentsManager.vue')),
    ai: section(() => import('@/Components/Features/Admin/AdminAiManager.vue')),
    references: section(() => import('@/Components/Features/Admin/AdminReferencesManager.vue')),
    seo: section(() => import('@/Components/Features/Admin/AdminSeoManager.vue')),
    telegramUsers: section(() => import('@/Components/Features/Admin/AdminTelegramUsers.vue')),
    botBroadcasts: section(() => import('@/Components/Features/Admin/AdminBotBroadcasts.vue')),
    adminTab: section(() => import('@/Components/Features/Settings/SettingsAdminTab.vue')),
  }
}
