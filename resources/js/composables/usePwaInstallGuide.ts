import { computed, ref } from 'vue'
import { usePwa } from '@/composables/usePwa'

/** Платформа для инструкции по установке. */
export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown'

/** Браузер на iOS: от него зависит, можно ли добавиться на Домой. */
export type IosBrowser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'inapp' | 'other' | 'unknown'

/** Один шаг инструкции по установке. */
export interface InstallStep {
  icon: string
  title: string
  text: string
}

const guideOpen = ref(false)
const installing = ref(false)

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
 * Определяет браузер на iOS по user agent.
 *
 * На iOS кнопка «На экран "Домой"» есть только в Safari.
 * В Chrome/Firefox/Edge и во встроенных браузерах
 * (Telegram, Instagram, TikTok, VK) её нет — надо сначала открыть в Safari.
 *
 * @returns вид iOS-браузера
 */
export function detectIosBrowser(): IosBrowser {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''

  const isInApp = /Telegram|Instagram|FBAN|FBAV|Line\/|VKClient|VKontakte|TikTok|Musical\.ly|Twitter|Snapchat|Pinterest|WeChat|Micromessenger/i.test(ua)
  if (isInApp) return 'inapp'

  const isCriOS = /CriOS/i.test(ua)
  if (isCriOS) return 'chrome'

  const isFxiOS = /FxiOS/i.test(ua)
  if (isFxiOS) return 'firefox'

  const isEdgiOS = /EdgiOS/i.test(ua)
  if (isEdgiOS) return 'edge'

  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)
  if (isSafari) return 'safari'

  return 'other'
}
/**
 * Инструкция по установке PWA, когда системный промпт недоступен
 * (iOS Safari, десктоп без beforeinstallprompt).
 *
 * Состояние диалога общее для всего приложения: открыть можно
 * из баннера или из настроек кнопкой «Установить».
 * На iOS дополнительно определяет браузер: установка на экран «Домой»
 * работает только из Safari, из Chrome/in-app сначала надо перейти в Safari.
 *
 * @returns платформа, шаги, состояние диалога и установка
 * @example
 * const guide = usePwaInstallGuide()
 * await guide.install()
 */
export function usePwaInstallGuide() {
  const { canInstall, promptInstall } = usePwa()
  const platform = ref<InstallPlatform>(detectInstallPlatform())
  const iosBrowser = ref<IosBrowser>(detectIosBrowser())
  const copyState = ref<'idle' | 'done' | 'error'>('idle')

  const isIos = computed(() => platform.value === 'ios')
  const isIosSafari = computed(() => isIos.value && iosBrowser.value === 'safari')
  const needsSafariRedirect = computed(() => isIos.value && !isIosSafari.value)

  /** Заголовок диалога под платформу. */
  const title = computed(() => {
    if (isIos.value) return 'Установка на iPhone'
    return 'Как установить ULove'
  })

  /** Подзаголовок: сразу честно говорим, что на iPhone кнопки «Установить» нет. */
  const subtitle = computed(() => {
    if (needsSafariRedirect.value) return 'На iPhone установка только через Safari — сейчас ты в другом браузере'
    if (isIos.value) return 'На iPhone нет кнопки «Установить» — Apple разрешает только вручную через Safari, это 15 секунд'
    return 'Твой браузер не показал системную кнопку — поставь вручную за минуту'
  })

  /** Шаги установки под текущую платформу. */
  const steps = computed<InstallStep[]>(() => {
    if (isIos.value && needsSafariRedirect.value) {
      return buildIosRedirectSteps()
    }
    if (isIos.value) {
      return buildIosSafariSteps()
    }
    if (platform.value === 'android') {
      return buildAndroidSteps()
    }
    return buildDesktopSteps()
  })

  /** Короткий текст для баннера под платформу. */
  const hint = computed(() => {
    if (isIos.value) return 'Safari → Поделиться → На экран «Домой»'
    return 'как приложение: быстрее и на весь экран'
  })

  /** Открывает диалог с инструкцией. */
  function openGuide(): void {
    const nextPlatform = detectInstallPlatform()
    platform.value = nextPlatform
    iosBrowser.value = detectIosBrowser()
    copyState.value = 'idle'
    guideOpen.value = true
  }

  /** Закрывает диалог с инструкцией. */
  function closeGuide(): void {
    guideOpen.value = false
  }

  /**
   * Копирует текущую ссылку в буфер: нужно для перехода из
   * встроенного браузера (Telegram/Instagram) в Safari.
   */
  async function copyLink(): Promise<void> {
    const pageUrl = window.location.href
    try {
      await navigator.clipboard.writeText(pageUrl)
      copyState.value = 'done'
    } catch {
      copyState.value = 'error'
    }
  }

  /**
   * Устанавливает приложение: сразу системный промпт, если доступен,
   * иначе открывает инструкцию (iOS и случаи без промпта).
   *
   * @returns исход системного промпта или 'guide'
   */
  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable' | 'guide'> {
    const promptAvailable = canInstall.value
    if (!promptAvailable) {
      openGuide()
      return 'guide'
    }
    const alreadyInstalling = installing.value
    if (alreadyInstalling) return 'unavailable'
    installing.value = true
    try {
      const outcome = await promptInstall()
      return outcome
    } finally {
      installing.value = false
    }
  }

  return { platform, iosBrowser, isIos, isIosSafari, needsSafariRedirect, title, subtitle, steps, hint, guideOpen, installing, copyState, openGuide, closeGuide, copyLink, install }
}

/**
 * Шаги для iOS Safari: Поделиться → На экран Домой → Добавить.
 *
 * @returns шаги установки из Safari
 */
function buildIosSafariSteps(): InstallStep[] {
  const shareStep: InstallStep = {
    icon: 'pi pi-share-alt',
    title: 'Нажми «Поделиться»',
    text: 'Внизу Safari кнопка-квадрат со стрелкой вверх',
  }
  const homeStep: InstallStep = {
    icon: 'pi pi-plus',
    title: '«На экран “Домой”»',
    text: 'Пролистни меню вниз и выбери этот пункт',
  }
  const confirmStep: InstallStep = {
    icon: 'pi pi-check',
    title: 'Нажми «Добавить»',
    text: 'ULove появится как приложение и откроется без адресной строки',
  }
  return [shareStep, homeStep, confirmStep]
}

/**
 * Шаги для iOS не из Safari: сначала перейти в Safari, потом как обычно.
 *
 * @returns шаги с переходом в Safari
 */
function buildIosRedirectSteps(): InstallStep[] {
  const openStep: InstallStep = {
    icon: 'pi pi-compass',
    title: 'Открой ссылку в Safari',
    text: 'Нажми ••• / «Открыть в браузере» либо скопируй ссылку кнопкой ниже и вставь в Safari',
  }
  const safariSteps = buildIosSafariSteps()
  return [openStep, ...safariSteps]
}

/**
 * Шаги для Android без системного промпта.
 *
 * @returns шаги установки на Android
 */
function buildAndroidSteps(): InstallStep[] {
  const menuStep: InstallStep = {
    icon: 'pi pi-ellipsis-v',
    title: 'Открой меню ⋮',
    text: 'Меню браузера в правом верхнем углу',
  }
  const installStep: InstallStep = {
    icon: 'pi pi-download',
    title: '«Установить приложение»',
    text: 'Нажми пункт установки ULove',
  }
  const confirmStep: InstallStep = {
    icon: 'pi pi-check',
    title: 'Подтверди',
    text: 'Подтверди установку — иконка появится на главном экране',
  }
  return [menuStep, installStep, confirmStep]
}

/**
 * Шаги для десктопа без системного промпта.
 *
 * @returns шаги установки на десктопе
 */
function buildDesktopSteps(): InstallStep[] {
  const addressStep: InstallStep = {
    icon: 'pi pi-download',
    title: 'Иконка в адресной строке',
    text: 'Нажми иконку установки справа в адресной строке',
  }
  const menuStep: InstallStep = {
    icon: 'pi pi-ellipsis-v',
    title: 'Или меню ⋮',
    text: 'Меню браузера → «Установить ULove»',
  }
  const confirmStep: InstallStep = {
    icon: 'pi pi-check',
    title: 'Подтверди «Установить»',
    text: 'ULove откроется в отдельном окне как приложение',
  }
  return [addressStep, menuStep, confirmStep]
}
