import { route } from '@/route'

/**
 * Резолв pipe-роута с фолбэком на путь-версию.
 *
 * Имена `pipe.*` (канонический домен pipe.ulove.by) существуют в Ziggy
 * только когда задан PIPE_DOMAIN; `pipe.path.*` (/pipe, /pipe/thread/{id})
 * зарегистрированы всегда и на любом хосте. Приложения код не должен
 * падать «route is not in the route list», поэтому сначала пробуем
 * каноническое имя, а при его отсутствии строим путь-версию.
 *
 * @param name логическое имя страницы: 'index' | 'show' | 'profile'
 * @param params параметры роута ({ thread: id } для 'show')
 * @returns URL страницы Pipe
 *
 * @example
 * pipeRoute('show', { thread: 42 }) // 'https://pipe.ulove.by/thread/42' либо '/pipe/thread/42'
 */
export function pipeRoute(name: 'index' | 'show' | 'profile', params?: Record<string, unknown>): string {
  const candidates = [`pipe.${name}`, `pipe.path.${name}`]

  for (const candidate of candidates) {
    try {
      const exists = route().has(candidate)
      if (exists) return String(route(candidate, params))
    } catch {
      // Конфиг Ziggy недоступен (SSR до гидрации) — идём к следующему кандидату.
    }
  }

  return '/pipe'
}
