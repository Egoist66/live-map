import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { useProfileUrl } from '@/composables/useProfileUrl'

/**
 * Переход по клику на @упоминание в тексте.
 *
 * Рендер (`renderWithMentions`) помечает упоминания атрибутом `data-mention`,
 * этот хук ловит клик по ним, находит пользователя через поиск и открывает его профиль.
 * Если профиль недоступен (скрыт/удалён) — молча игнорирует клик.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useMentionNavigate } from '@/composables/useMentionNavigate'
 * const mentionNav = useMentionNavigate()
 * </script>
 * <template>
 *   <div v-html="renderWithMentions(text)" @click="mentionNav.onRichClick" />
 * </template>
 * ```
 *
 * @returns действия для перехода по упоминаниям
 */
export function useMentionNavigate() {
  const { userProfileUrl } = useProfileUrl()
  /**
   * Открывает профиль пользователя по имени из упоминания.
   * @param name имя без `@`
   * @returns true если профиль найден и открыт
   */
  async function openMention(name: string): Promise<boolean> {
    const query = (name ?? '').trim()
    if (!query) {
      return false
    }
    try {
      const res = await chatApi.search(query)
      const nested = (res as { data?: unknown })?.data
      const results = Array.isArray(res) ? (res as Array<{ id: number; name: string; profile_slug?: string | null }>) : (Array.isArray(nested) ? (nested as Array<{ id: number; name: string; profile_slug?: string | null }>) : [])
      const exact = results.find((u) => u.name.toLowerCase() === query.toLowerCase())
      const target = exact ?? results[0]
      if (!target?.id) {
        return false
      }
      router.visit(userProfileUrl(target))
      return true
    } catch {
      return false
    }
  }

  /**
   * Обработчик клика по rich-тексту: перехватывает только клики по упоминаниям.
   * Ссылки и остальной контент пропускает без изменений.
   * @param e событие клика
   * @returns true если клик был по упоминанию
   */
  function onRichClick(e: MouseEvent): boolean {
    try {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-mention]')
      if (!el) {
        return false
      }
      e.preventDefault()
      e.stopPropagation()
      const name = el.getAttribute('data-mention') ?? ''
      void openMention(name)
      return true
    } catch {
      return false
    }
  }

  return { openMention, onRichClick }
}
