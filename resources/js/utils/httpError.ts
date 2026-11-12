/**
 * HTTP-статус ошибки axios-запроса.
 *
 * Серверные ошибки приходят в разных формах (AxiosError, обычный Error),
 * поэтому статус достаётся защищённо и всегда приводится к числу.
 *
 * @param error ошибка запроса
 * @returns числовой статус ответа (0 — сеть/неизвестная ошибка)
 *
 * @example
 * const status = httpStatus(error) // 404
 */
export function httpStatus(error: unknown): number {
  const rawStatus = (error as { response?: { status?: unknown } })?.response?.status
  const status = Number(rawStatus)
  return Number.isFinite(status) ? status : 0
}

/**
 * Сущность уже удалена на сервере (404).
 *
 * Используется для мягкой обработки устаревшего кеша: если другое
 * устройство удалило запись, действие над ней не должно показывать
 * красный тост ошибки — запись просто убирается из локальной выдачи.
 *
 * @param error ошибка запроса
 * @returns true, если сервер ответил 404
 */
export function isNotFoundError(error: unknown): boolean {
  return httpStatus(error) === 404
}
