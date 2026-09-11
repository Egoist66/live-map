import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePwa } from '@/composables/usePwa'
import { useBuildVersion } from '@/composables/useBuildVersion'

/**
 * Владелец видимого баннера: только один экземпляр показывает баннер,
 * остальные молчат. Защита от задвоения при смене лейаутов.
 */
let bannerOwner: symbol | null = null
const ownershipEpoch = ref(0)

/**
 * Баннер обновления приложения.
 *
 * Показывается когда вышел новый билд (деплой в Laravel Cloud)
 * или service worker нашел обновление. Кнопка стирает весь кэш
 * и перезагружает приложение на свежую версию.
 */
export function useAppRefreshBanner() {
  const pwa = usePwa()
  const build = useBuildVersion()
  const instanceId = Symbol('pwa-update-banner')
  const isOwner = ref(false)

  /**
   * Захватывает право показывать баннер, если оно свободно.
   */
  function tryClaim(): void {
    if (bannerOwner === null) {
      bannerOwner = instanceId
      isOwner.value = true
    }
  }

  /**
   * Освобождает право показа при размонтировании.
   */
  function releaseClaim(): void {
    if (bannerOwner === instanceId) {
      bannerOwner = null
      isOwner.value = false
      ownershipEpoch.value += 1
    }
  }

  onMounted(tryClaim)
  onBeforeUnmount(releaseClaim)
  watch(ownershipEpoch, tryClaim)

  const visible = computed(() => isOwner.value && (pwa.needUpdate.value || build.buildUpdateAvailable.value))
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
