import { onMounted } from 'vue'

/**
 * Плавный скролл к якорю из hash URL после монтирования.
 *
 * Для диплинков вида `/settings/security#sessions` (кнопка «Мои сеансы»
 * из Telegram-бота): таб открывается по маршруту, а hash до сервера
 * не долетает — докрутку делает клиент. Без совпадающего hash — no-op.
 * Логика в хуке по Правилу №1, компонент только вешает `id` и зовёт хук.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAnchorScroll } from '@/composables/useAnchorScroll'
 * useAnchorScroll('sessions')
 * </script>
 * <template>
 *   <span id="sessions" class="block scroll-mt-28" aria-hidden="true" />
 *   ...
 * </template>
 * ```
 *
 * @param anchorId id якоря без `#`
 * @returns метод ручной докрутки
 */
export function useAnchorScroll(anchorId: string) {
  /**
   * Докрутить к якорю, если hash URL совпадает.
   *
   * Двойная попытка: сразу (DOM уже смонтирован) и кадром позже
   * (добивка после первой отрисовки тяжёлых списков).
   *
   * @returns void
   */
  function scrollToAnchor(): void {
    let element: HTMLElement | null = null

    try {
      if (window.location.hash !== `#${anchorId}`) {
        return
      }

      element = document.getElementById(anchorId)
    } catch {
      return
    }

    if (!element) {
      return
    }

    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      element.scrollIntoView()
    }
  }

  onMounted(() => {
    scrollToAnchor()
    requestAnimationFrame(() => {
      setTimeout(scrollToAnchor, 200)
    })
  })

  return { scrollToAnchor }
}
