import { computed, watch } from 'vue'
import { busOn } from '@/services/realtime-bus'
import { useSosStore } from '@/stores/sos'
import { usePinsStore } from '@/stores/pins'

/** Как часто перепроверять живой вызов (удаление/истечение пина) */
const SOS_WATCH_INTERVAL = 4000

/**
 * SOS-режим карты: изоляция пинов, баннер, переход в чат.
 *
 * Когда у пользователя активный SOS (создатель или принявший),
 * на карте виден только этот пин — остальные скрываются до завершения.
 *
 * @returns состояние режима и действия
 * @example
 * const mode = useSosMode()
 * await mode.init()
 */
export function useSosMode() {
  const sos = useSosStore()
  const pins = usePinsStore()

  const isSosMode = computed(() => sos.isSosMode)
  const sosPin = computed(() => sos.active?.pin ?? null)
  const sosPinId = computed(() => Number(sos.active?.pin?.id ?? 0) || null)

  /**
   * Загрузить SOS и вычистить лишние пины из стора.
   */
  async function init(): Promise<void> {
    await sos.load()
    enforceIsolation()
  }

  /**
   * Оставить в сторе только SOS-пин (остальные скрыты на время вызова).
   */
  function enforceIsolation(): void {
    const id = sosPinId.value
    if (!id) return
    pins.pins = (pins.pins as any[]).filter((p: any) => Number(p.id) === id)
  }

  /**
   * Обновить SOS и при его завершении перезагрузить ленту пинов.
   * @param refetch перезагрузка ленты после выхода из режима
   * @returns true если режим только что завершился
   */
  async function refresh(refetch?: () => Promise<unknown>): Promise<boolean> {
    const wasMode = sos.isSosMode
    await sos.load()
    if (!sos.isSosMode && wasMode) {
      try {
        await refetch?.()
      } catch {}
      return true
    }
    enforceIsolation()
    return false
  }

  let unbindWatcher: (() => void) | null = null
  let unbindBus: (() => void) | null = null
  let unbindSocket: (() => void) | null = null
  let watchTimer: ReturnType<typeof setInterval> | null = null
  let exitHandlers: { refetch: () => Promise<unknown>; closePin: () => void; renderPins?: () => void } | null = null

  /**
   * Подписаться на стор пинов: вычищать лишнее, пока режим активен.
   */
  function bind(): void {
    unbindWatcher?.()
    unbindWatcher = watch([() => (pins.pins as any[]).length, sosPinId], () => enforceIsolation())
  }

  /**
   * Отписаться от слежения за изоляцией.
   */
  function unbind(): void {
    unbindWatcher?.()
    unbindWatcher = null
    stopAutoExit()
  }

  /**
   * Проверить, жив ли вызов; если завершился удалением/истечением —
   * выйти из изоляции: убрать пин, закрыть карточку, обновить ленту.
   */
  async function checkExit(): Promise<void> {
    if (!sos.isSosMode) return
    const pinId = sosPinId.value
    await sos.load()
    if (sos.isSosMode) return
    if (pinId) {
      try {
        pins.removeRealtime(pinId)
      } catch {}
    }
    try {
      exitHandlers?.closePin()
    } catch {}
    try {
      await exitHandlers?.refetch()
    } catch {}
  }

  /**
   * Убрать SOS-пин из стора и перерисовать карту мгновенно,
   * не дожидаясь ответа `/api/sos/mine`.
   * @param pinId id завершённого SOS-пина
   */
  function dropSosPinInstantly(pinId: number): void {
    if (!pinId) {
      return
    }
    try {
      pins.removeRealtime(pinId)
    } catch {}
    try {
      exitHandlers?.renderPins?.()
    } catch {}
  }

  /**
   * Завершить свой SOS мгновенно для карты: пин убирается из стора
   * и перерисовывается до ответа сервера, карточка закрывается.
   * При ошибке закрытия лента перечитывается обратно.
   *
   * @param handlers refetch ленты, закрытие карточки и перерисовка маркеров
   * @returns true если закрытие удалось
   */
  async function closeOwnSos(handlers: { refetch: () => Promise<unknown>; closePin: () => void; renderPins?: () => void }): Promise<boolean> {
    const pinId = sosPinId.value
    if (!pinId) {
      return false
    }
    const previousHandlers = exitHandlers
    exitHandlers = handlers
    dropSosPinInstantly(pinId)
    try {
      handlers.closePin()
    } catch {}
    try {
      await sos.close(pinId)
    } catch {
      try {
        await handlers.refetch()
      } catch {}
      try {
        handlers.renderPins?.()
      } catch {}
      exitHandlers = previousHandlers
      return false
    }
    try {
      await handlers.refetch()
    } catch {}
    try {
      handlers.renderPins?.()
    } catch {}
    exitHandlers = previousHandlers
    return true
  }
  /**
   * Следить за завершением вызова на обоих транспортах.
   *
   * Удаление пина прилетает сокетом pin.deleted и поллингом
   * map:pins.deleted — плюс тихий интервал на случай истечения TTL.
   * Пин убирается из стора сразу по событию удаления, затем
   * проверяется статус вызова. При выходе вызывается refetch/closePin страницы.
   *
   * @param handlers refetch ленты, закрытие карточки и перерисовка маркеров
   */
  function bindAutoExit(handlers: { refetch: () => Promise<unknown>; closePin: () => void; renderPins?: () => void }): void {
    exitHandlers = handlers
    stopAutoExit()
    unbindBus = busOn('map:pins', (payload: any) => {
      const deleted = Array.isArray(payload?.deleted) ? payload.deleted.map((id: unknown) => Number(id)) : []
      const id = sosPinId.value
      if (id && deleted.includes(id)) {
        dropSosPinInstantly(id)
        void checkExit()
      }
    })
    try {
      const channel = (window as any).Echo?.channel?.('map')
      if (channel?.listen) {
        const onSocketDeleted = (event: any): void => {
          const deletedId = Number(event?.pinId ?? 0)
          const id = sosPinId.value
          if (id && deletedId === id) {
            dropSosPinInstantly(id)
            void checkExit()
          }
        }
        channel.listen('.pin.deleted', onSocketDeleted)
        unbindSocket = () => {
          try {
            channel.stopListening?.('.pin.deleted', onSocketDeleted)
          } catch {}
        }
      }
    } catch {}
    watchTimer = setInterval(() => {
      if (!document.hidden) void checkExit()
    }, SOS_WATCH_INTERVAL)
  }

  /**
   * Остановить слежение за завершением.
   */
  function stopAutoExit(): void {
    try {
      unbindBus?.()
    } catch {}
    unbindBus = null
    try {
      unbindSocket?.()
    } catch {}
    unbindSocket = null
    if (watchTimer) clearInterval(watchTimer)
    watchTimer = null
  }

  return { sos, isSosMode, sosPin, sosPinId, init, enforceIsolation, refresh, bind, unbind, checkExit, closeOwnSos, bindAutoExit, stopAutoExit }
}
