import { computed } from 'vue'
import { useTelegram } from '@/composables/useTelegram'

/**
 * Ранний DOM-признак мобильного Telegram (без ожидания моста).
 *
 * Ранний инлайн в blade ставит `tg-app` + `tg-mobile` на `<html>`
 * до paint: первый кадр уже знает клиента, хотя `initTelegram()`
 * договорится с WebApp только после маунта. SSR-защита внутри.
 *
 * @returns true когда blade уже пометил страницу мобильным TG
 */
function readEarlyTgMobile(): boolean {
  try {
    if (typeof document === 'undefined') return false
    const root = document.documentElement
    return root.classList.contains('tg-app') && root.classList.contains('tg-mobile')
  } catch {
    return false
  }
}

/**
 * Компактный режим для мобильного Telegram Mini App.
 *
 * Лента свайпов в TG-клиенте живёт под нативными кнопками
 * (закрыть/свернуть/меню поверх WebView): топбар собирается
 * в кластер по центру, карточка ниже и короче, кнопки меньше.
 * Рефы моста (`isTelegram`/`isDesktopTelegram`) плюс ранние
 * классы blade — без вспышки полного топбара на первом кадре.
 *
 * @returns флаг компактного TG-режима
 * @example
 * const { isTgMobile } = useTgMobile()
 * // <span v-show="!isTgMobile" class="flex-1" />
 */
export function useTgMobile() {
  const { isTelegram, isDesktopTelegram } = useTelegram()

  const isTgMobile = computed(() => {
    if (isTelegram.value && !isDesktopTelegram.value) return true
    return readEarlyTgMobile()
  })

  return { isTgMobile }
}
