import { computed } from 'vue'
import { usePwa } from '@/composables/usePwa'
import { useBuildVersion } from '@/composables/useBuildVersion'

/**
 * Баннер обновления приложения.
 *
 * Показывается когда вышел новый билд (деплой в Laravel Cloud)
 * или service worker нашел обновление. Кнопка стирает весь кэш
 * и перезагружает приложение на свежую версию.
 *
 * Владение не нужно: лейауты per-page, одновременно смонтирован всегда
 * один экземпляр баннера. Старый механизм owner/epoch давал мигание
 * «появился и пропал» на каждой навигации (размонтирование + захват),
 * поэтому видимость — чистая функция залипающих флагов.
 */
export function useAppRefreshBanner() {
  const pwa = usePwa()
  const build = useBuildVersion()

  const visible = computed(() => pwa.needUpdate.value || build.buildUpdateAvailable.value)
  const isBuildUpdate = computed(() => build.buildUpdateAvailable.value)
  const busy = computed(() => build.refreshing.value)

  async function apply(): Promise<void> {
    if (build.buildUpdateAvailable.value) {
      await build.refreshApp()
      return
    }

    await pwa.applyUpdate()
  }

  function dismiss(): void {
    pwa.dismissUpdate()
    build.dismissBuildUpdate()
  }

  return { visible, isBuildUpdate, busy, online: pwa.online, apply, dismiss }
}
