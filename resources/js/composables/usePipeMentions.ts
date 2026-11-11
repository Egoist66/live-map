import { useMentionNavigate } from '@/composables/useMentionNavigate'
import { usePipeStore } from '@/stores/pipe'
import type { PipeReply } from '@/types/pipe'

/** Длительность подсветки ответа после скролла к нему, мс. */
const FLASH_MS = 1800

/**
 * Клики по @упоминаниям в Pipe (тексты тредов и ответов).
 *
 * Рендер `renderWithMentions` помечает упоминания `data-mention`;
 * этот хук ловит клик и сначала ищет ответ автора с этим ником
 * в уже загруженной ветке: найден — плавный скролл к нему с
 * краткой подсветкой. Не найден (ник нигде не писал в ветке) —
 * открываем его публичный профиль, как в остальных разделах.
 *
 * @example
 * ```vue
 * <div v-html="renderWithMentions(reply.body)" @click="mentions.onBodyClick" />
 * ```
 *
 * @returns действия для кликов по упоминаниям
 */
export function usePipeMentions() {
  const store = usePipeStore()
  const { openMention } = useMentionNavigate()

  /**
   * Найти в загруженной ветке первый ответ автора с таким ником
   * (регистр не важен). Ник может быть первым словом полного имени
   * («@Иван» у автора «Иван Петров»): сравниваем и точное имя, и
   * префикс через пробел. Дети обходятся после родителя: верхний
   * уровень приоритетнее для скролла.
   *
   * @param name ник без `@`
   * @param list ветка ответов (по умолчанию загруженный тред)
   * @returns ответ автора или null
   */
  function findReplyByAuthor(name: string, list?: PipeReply[]): PipeReply | null {
    const target = name.trim().toLowerCase()
    if (!target) return null

    const matchesAuthor = (authorName: string): boolean => {
      const full = authorName.trim().toLowerCase()
      return full === target || full.startsWith(`${target} `)
    }

    const walk = (items: PipeReply[]): PipeReply | null => {
      for (const item of items) {
        if (!item.is_anonymous && matchesAuthor(item.author?.name ?? '')) {
          return item
        }
      }
      for (const item of items) {
        const child = item.replies?.length ? walk(item.replies) : null
        if (child) return child
      }
      return null
    }

    return walk(list ?? store.replies)
  }

  /**
   * Плавно проскроллить к ответу и подсветить его на FLASH_MS.
   *
   * @param replyId ответ
   */
  function scrollToReply(replyId: number): void {
    const el = document.querySelector(`[data-pipe-reply="${replyId}"]`)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    el.classList.add('pipe-mention-flash')
    window.setTimeout(() => el.classList.remove('pipe-mention-flash'), FLASH_MS)
  }

  /**
   * Обработчик клика по rich-тексту: перехватывает только клики
   * по упоминаниям, остальное (ссылки) пропускает без изменений.
   *
   * @param e событие клика
   * @returns true если клик был по упоминанию
   */
  function onBodyClick(e: MouseEvent): boolean {
    try {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-mention]')
      if (!el) return false

      e.preventDefault()
      e.stopPropagation()

      const name = el.getAttribute('data-mention') ?? ''
      const target = findReplyByAuthor(name)

      if (target) {
        scrollToReply(target.id)
        return true
      }

      void openMention(name)
      return true
    } catch {
      return false
    }
  }

  return { findReplyByAuthor, scrollToReply, onBodyClick }
}
