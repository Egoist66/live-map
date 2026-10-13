import type { App } from 'vue'

/**
 * Самовосстановление после протухшего билда.
 *
 * После деплоя HTML может ссылаться на уже удалённые чанки
 * (`/build/assets/*`): entry падает с 404 (ловит сторож в blade),
 * а ленивые чанки — с `Failed to fetch dynamically imported module`.
 * Без обработки визит умирает белым экраном, а кнопка «назад»
 * показывает тот же мёртвый HTML.
 *
 * Мост с blade-сторожем (`resources/views/app.blade.php`):
 * - флаг `window.__upinBooted` ставит app.ts сразу после mount;
 * - счётчик самоперезагрузок общий (`upin:boot-reloads` в sessionStorage):
 *   максимум 2 за 5 минут суммарно на все точки (сторож, резолвер страниц,
 *   глобальный хендлер) — петель перезагрузки нет, дальше показываем
 *   фолбэк-панель сторожа.
 *
 * @example
 * ```ts
 * const { markBooted, installGlobalRecovery } = useBootRecovery()
 * installGlobalRecovery(app)
 * app.mount(el)
 * markBooted()
 * ```
 */

declare global {
  interface Window {
    __upinBooted?: boolean
  }
}

const RELOAD_KEY = 'upin:boot-reloads'
const MAX_RELOADS = 2
const RELOAD_WINDOW_MS = 5 * 60 * 1000
const FALLBACK_NODE_ID = 'upin-boot-fallback'

/**
 * Сигнатуры ошибок загрузки чанков после деплоя.
 */
const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /loading chunk \S+ failed/i,
  /loading css chunk/i,
  /importing a module script failed/i,
  /unable to preload css/i,
  /chunkloaderror/i,
]

/**
 * Это ошибка протухшего чанка, а не прикладной баг.
 *
 * @param value ошибка, сообщение или стек
 * @returns true если похоже на 404 чанка после деплоя
 */
export function isChunkLoadError(value: unknown): boolean {
  if (typeof value === 'string') {
    return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(value))
  }

  if (value instanceof Error) {
    const haystack = `${value.message}\n${value.stack ?? ''}`

    return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(haystack))
  }

  return false
}

/**
 * Прочитать общий счётчик самоперезагрузок.
 *
 * @returns счётчик и метка окна
 */
function readGuard(): { count: number; firstAt: number } {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY)

    if (!raw) {
      return { count: 0, firstAt: 0 }
    }

    const parsed = JSON.parse(raw) as { count?: number; firstAt?: number }

    return { count: Number(parsed.count) || 0, firstAt: Number(parsed.firstAt) || 0 }
  } catch {
    return { count: 0, firstAt: 0 }
  }
}

/**
 * Построить URL мимо всех кэшей (SW, HTTP, edge): свежий HTML после деплоя.
 *
 * Параметр `?v=` чистит `stripRefreshParam` в `useBuildVersion` после бута.
 *
 * @returns текущий URL с cache-buster
 */
export function buildCacheBustedUrl(): string {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(Date.now()))

    return url.toString()
  } catch {
    return window.location.href
  }
}

/**
 * Потратить одну самоперезагрузку из общего бюджета.
 *
 * Первая попытка — мягкая (`reload`, берёт свежий HTML по сети),
 * вторая — жёсткая (`replace` с `?v=` мимо SW/HTTP-кэшей).
 * Бюджет исчерпан — возвращаем null, лечиться нечем (покажет фолбэк сторож blade).
 *
 * @returns 'reload' | 'bust' — как перезагружаться, null — бюджет исчерпан
 */
export function consumeRecoveryReload(): 'reload' | 'bust' | null {
  if (typeof window === 'undefined') {
    return null
  }

  const now = Date.now()
  const guard = readGuard()
  const fresh = guard.firstAt > 0 && now - guard.firstAt < RELOAD_WINDOW_MS
  const count = fresh ? guard.count : 0

  if (count >= MAX_RELOADS) {
    return null
  }

  try {
    sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ count: count + 1, firstAt: fresh ? guard.firstAt : now }))
  } catch {
    // Без счётчика перезагрузка превращается в вечный цикл —
    // запрещаем её, пусть покажется фолбэк сторожа.
    return null
  }

  return count === 0 ? 'reload' : 'bust'
}

/**
 * Применить самоперезагрузку: потратить бюджет и перейти.
 *
 * @returns true если перезагрузка запущена, false если бюджет исчерпан
 */
export function recoverWithReload(): boolean {
  const mode = consumeRecoveryReload()

  if (mode === 'bust') {
    window.location.replace(buildCacheBustedUrl())

    return true
  }

  if (mode === 'reload') {
    window.location.reload()

    return true
  }

  return false
}

/**
 * Отметить успешный бут: гасит сторожа blade и убирает его фолбэк.
 */
export function markBooted(): void {
  try {
    window.__upinBooted = true
    document.getElementById(FALLBACK_NODE_ID)?.remove()
  } catch {
    // No-op: сторожевая разметка необязательна для работы.
  }
}

/**
 * Хук самовосстановления: метка бута, глобальные ловушки ошибок чанков,
 * безопасный mount с лечением краха гидратации.
 *
 * @returns markBooted/installGlobalRecovery/mountAppWithRecovery
 */
export function useBootRecovery() {
  /**
   * Поставить глобальные ловушки ошибок протухших чанков.
   *
   * Ловит три канала, которыми умирает визит после деплоя:
   * - `errorHandler` Vue (краш рендера страницы/лейаута — иначе мёртвый `#app`
   *   и белый экран на всех следующих переходах, т.к. инстанс отравлен);
   * - `unhandledrejection` (упавший динамический import вне резолвера страниц);
   * - `error` в capture-фазе (404 модуля/прелоада — до них резолвер не добирается).
   * Прикладные ошибки только логируем, не трогаем.
   *
   * @param app Vue-приложение до mount
   */
  function installGlobalRecovery(app: App): void {
    const previousHandler = app.config.errorHandler

    app.config.errorHandler = (error, instance, info) => {
      if (isChunkLoadError(error)) {
        recoverWithReload()

        return
      }

      if (typeof previousHandler === 'function') {
        previousHandler(error, instance, info)

        return
      }

      // eslint-disable-next-line no-console
      console.error('[upin] render error:', info, error)
    }

    window.addEventListener('unhandledrejection', (event) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault()
        recoverWithReload()
      }
    })

    window.addEventListener(
      'error',
      (event) => {
        const target = event.target as (EventTarget & { src?: unknown; href?: unknown }) | null
        const src = target !== window ? String(target?.src ?? target?.href ?? '') : ''

        if (src.includes('/build/assets/') || isChunkLoadError(event.message)) {
          recoverWithReload()
        }
      },
      true,
    )
  }

  /**
   * Смонтировать приложение с лечением краха гидратации.
   *
   * SSR-разметка + клиентский JS разных деплоев дают не варнинг, а исключение
   * в mount (админка так и белела до ручной перезагрузки): вместо мёртвого
   * экрана — перезагрузка на свежий консистентный билд из бюджета выше.
   *
   * @param app Vue-приложение
   * @param el корневой узел (`#app`)
   */
  function mountAppWithRecovery(app: App, el: Element): void {
    try {
      app.mount(el)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[upin] mount failed:', error)

      if (!recoverWithReload()) {
        throw error
      }
    }
  }

  return { markBooted, installGlobalRecovery, mountAppWithRecovery }
}
