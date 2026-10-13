import { onErrorCaptured, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { isRecoverableRenderError } from '@/composables/useBootRecovery'

/**
 * Граница ошибок контента страницы: белый экран превращает
 * в панель восстановления.
 *
 * Краш рендера страницы (битый чанк после деплоя, рассинхрон
 * гидратации, исключение в setup) без границы отравляет корневой
 * инстанс Vue: белеет и текущий роут, и все следующие («назад»
 * тоже белое до ручной перезагрузки). Граница ловит падение ниже
 * корня (`onErrorCaptured` + `return false` гасит всплытие), корень
 * остаётся здоровым — навигация работает, а вместо пустоты видна
 * панель с кнопками «Повторить» / «Обновить страницу».
 *
 * Ошибки обработчиков событий (клики, ввод) не трогаем: они не
 * роняют дерево, панель на каждый чих была бы шумом — пусть летят
 * дальше в глобальный хендлер.
 *
 * @returns состояние границы и действия восстановления
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const boundary = useRouteErrorBoundary()
 * </script>
 * <template>
 *   <slot v-if="!boundary.routeError.value" />
 *   <div v-else>…панель…</div>
 * </template>
 * ```
 */
export function useRouteErrorBoundary() {
  const page = usePage()

  /** Упавшая ошибка рендера под границей; null — всё живо. */
  const routeError = ref<unknown | null>(null)

  /** Авто-ретрай протухшего чанка уже потрачен (максимум 1). */
  const autoRetried = ref(false)

  /**
   * Сбросить границу: перемонтировать контент страницы.
   */
  function reset(): void {
    routeError.value = null
  }

  /**
   * Жёстко обновиться мимо всех кэшей (SW, HTTP, edge).
   *
   * Параметр `?v=` чистит `stripRefreshParam` в `useBuildVersion`.
   */
  function hardReload(): void {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('v', String(Date.now()))
      window.location.replace(url.toString())
    } catch {
      window.location.reload()
    }
  }

  /**
   * Это ошибка обработчика события, а не рендера.
   *
   * Такие дерево не роняют — границу не поднимаем.
   *
   * @param info контекст Vue, откуда прилетела ошибка
   * @returns true если это клик/ввод и подобные
   */
  function isEventHandlerError(info: string): boolean {
    return /event handler/i.test(info)
  }

  onErrorCaptured((error, _instance, info) => {
    if (isEventHandlerError(String(info ?? ''))) {
      return true
    }

    // eslint-disable-next-line no-console
    console.error('[upin] route render error:', info, error)

    if (isRecoverableRenderError(error) && !autoRetried.value) {
      autoRetried.value = true

      window.setTimeout(() => {
        reset()
      }, 800)

      return false
    }

    routeError.value = error

    return false
  })

  watch(
    () => (page as { component?: string }).component,
    () => {
      autoRetried.value = false
      reset()
    },
  )

  watch(
    () => (page as { url?: string }).url,
    () => {
      reset()
    },
  )

  return { routeError, autoRetried, reset, hardReload }
}
