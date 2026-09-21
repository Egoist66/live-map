/**
 * Отложенные некритичные задачи: запуск после простоя main thread.
 *
 * Первый paint не должен ждать поллинги, пуши и версии: страница профиля
 * при монтировании дёргала ~15 API параллельно (бейджи, heartbeat,
 * уведомления ×2, апдейты ×2, realtime/mode+sync...), что давало TBT 1100мс
 * и TTI 12.7с в Lighthouse. Обёртка переносит такие иниты в idle.
 *
 * @example
 * ```ts
 * const { runWhenIdle } = useIdleTask()
 * onMounted(() => {
 *   void runWhenIdle(() => Promise.allSettled([a.init(), b.init()]))
 * })
 * ```
 *
 * @returns хелперы отложенного запуска
 */
export function useIdleTask() {
  /**
   * Выполнить задачу, когда браузер свободен.
   *
   * `requestIdleCallback` с фолбэком на `setTimeout`: Safari и SSR
   * колбэка не имеют. На сервере — no-op, задачу не запускаем.
   *
   * @param task асинхронная задача (ошибки глушатся — инициализация необязательна)
   * @param timeoutMs крайний срок запуска, если простоя не случилось
   * @returns промис завершения задачи
   */
  async function runWhenIdle(task: () => unknown | Promise<unknown>, timeoutMs = 1500): Promise<void> {
    const isServer = typeof window === 'undefined'

    if (isServer) {
      return
    }

    await new Promise<void>((done) => {
      const idleWindow = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }

      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleWindow.requestIdleCallback(() => done(), { timeout: timeoutMs })

        return
      }

      window.setTimeout(() => done(), Math.min(timeoutMs, 1200))
    })

    try {
      await task()
    } catch {
      // No-op: фоновая инициализация не должна ронять визит.
    }
  }

  return { runWhenIdle }
}
