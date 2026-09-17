import { route as buildRoute } from 'ziggy-js'

declare const Ziggy: any | undefined

/**
 * SSR-safe обёртка над Ziggy `route()`.
 *
 * Голый глобал `route` (его кладёт в `window` blade-скрипт `@routes`)
 * не существует в Node, поэтому любой вызов в `<script setup>` / `.ts`
 * роняет SSR-рендер и Inertia молча откатывается в CSR (пустой `div#app`).
 * Этот хелпер явно резолвит конфиг: в браузере — из blade-глобала `Ziggy`,
 * в SSR — из `globalThis.Ziggy`, который под каждый запрос выставляет `ssr.ts`.
 *
 * Поведение в браузере идентично глобалу: тот же конфиг, те же URL.
 *
 * @param name имя роута; без имени возвращает роутер (для `.current()/.has()`)
 * @param params параметры роута
 * @param absolute абсолютный URL (по умолчанию true, как у Ziggy)
 * @param config явный конфиг Ziggy (перекрывает авторезолв)
 * @returns URL роута или роутер при вызове без имени
 *
 * @example
 * import { route } from '@/route'
 * const url = route('dashboard')
 * const isMap = route().current('map')
 */
export function route(name?: string, params?: any, absolute = true, config?: any): any {
  return (buildRoute as any)(name, params, absolute, resolveConfig(config))
}

/**
 * Резолвит конфиг Ziggy: явный → blade-глобал (браузер) → per-request (SSR).
 *
 * @param override явный конфиг, если передан вызывающим
 * @returns конфиг Ziggy с непустым `routes`
 * @throws Error если конфиг нигде не найден
 */
function resolveConfig(override?: any): any {
  if (override?.routes) return override

  if (typeof Ziggy !== 'undefined' && (Ziggy as any)?.routes) return Ziggy

  const fromSsr = (globalThis as any).Ziggy
  if (fromSsr?.routes) return fromSsr

  throw new Error('Ziggy error: missing configuration. Ensure @routes is rendered or ssr.ts provides page.props.ziggy.')
}
