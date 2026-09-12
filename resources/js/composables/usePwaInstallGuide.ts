import { computed, ref } from 'vue'
import { usePwa } from '@/composables/usePwa'

/** Платформа для инструкции по установке. */
export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown'

/** Один шаг инструкции по установке. */
export interface InstallStep {
  icon: string
  text: string
}

const guideOpen = ref(false)

/**
 * Определяет платформу по user agent.
 *
 * @returns платформа устройства
 */
export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  const touchMac = /Macintosh/.test(ua) && typeof window !== 'undefined' && navigator.maxTouchPoints > 1
  const isIos = /iPad|iPhone|iPod/.test(ua) || touchMac
  if (isIos) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux|X11/.test(ua)) return 'desktop'
  return 'unknown'
}

/**
 * Инструкция по установке PWA, когда системный промпт недоступен
 * (iOS Safari, десктоп без beforeinstallprompt).
 *
 * Состояние диалога общее для всего приложения: открыть можно
 * из баннера или из настроек кнопкой «Установить».
 *
 * @returns платформа, шаги, состояние диалога и установка
 * @example
 * const guide = usePwaInstallGuide()
 * await guide.install()
 */
export function usePwaInstallGuide() {
  const { canInstall, promptInstall } = usePwa()
  const platform = ref<InstallPlatform>(detectInstallPlatform())

  /** Шаги установки под текущую платформу. */
  const steps = computed<InstallStep[]>(() => {
    if (platform.value === 'ios') {
      return [
        { icon: 'pi pi-share-alt', text: 'Нажми кнопку «Поделиться» в Safari' },
        { icon: 'pi pi-plus', text: 'Выбери «На экран “Домой”»' },
        { icon: 'pi pi-check', text: 'Подтверди «Добавить» — UPin появится как приложение' },
      ]
    }
    if (platform.value === 'android') {
      return [
        { icon: 'pi pi-ellipsis-v', text: 'Открой меню ⋮ в браузере' },
        { icon: 'pi pi-download', text: 'Нажми «Установить приложение»' },
        { icon: 'pi pi-check', text: 'Подтверди установку' },
      ]
    }
    return [
      { icon: 'pi pi-download', text: 'Нажми иконку установки в адресной строке' },
      { icon: 'pi pi-ellipsis-v', text: 'Или открой меню ⋮ → «Установить UPin»' },
      { icon: 'pi pi-check', text: 'Подтверди «Установить»' },
    ]
  })

  /** Короткий текст для баннера под платформу. */
  const hint = computed(() => {
    if (platform.value === 'ios') return 'добавь на экран «Домой» — откроется как приложение'
    return 'как приложение: быстрее и на весь экран'
  })

  /** Открывает диалог с инструкцией. */
  function openGuide(): void {
    platform.value = detectInstallPlatform()
    guideOpen.value = true
  }

  /** Закрывает диалог с инструкцией. */
  function closeGuide(): void {
    guideOpen.value = false
  }

  /**
   * Устанавливает приложение: системный промпт, если доступен,
   * иначе открывает инструкцию.
   *
   * @returns исход системного промпта или 'guide'
   */
  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable' | 'guide'> {
    if (canInstall.value) return promptInstall()
    openGuide()
    return 'guide'
  }

  return { platform, steps, hint, guideOpen, openGuide, closeGuide, install }
}
