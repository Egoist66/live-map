import { useToast } from 'primevue/usetoast'
import { pipeRoute } from '@/services/pipe.routes'
import type { PipeThread } from '@/types/pipe'

/**
 * Шаринг pipe: нативная системная шара на мобильных, клипборд-фолбэк.
 *
 * Диплинк строится pipeRoute('show'): канонический домен pipe.ulove.by,
 * когда PIPE_DOMAIN задан, иначе путь-версия /pipe/thread/{id} —
 * ссылка всегда открывает тред в Pipe.
 *
 * @example
 * const { shareThread } = usePipeShare()
 * await shareThread(thread)
 */
export function usePipeShare() {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /**
   * Поделиться тредом: navigator.share → clipboard → тост об ошибке.
   *
   * @param thread тред Pipe
   */
  async function shareThread(thread: PipeThread): Promise<void> {
    const url = pipeRoute('show', { thread: thread.id })
    const authorLabel = thread.author?.name ?? 'Аноним'
    const title = `Pipe от ${authorLabel}`
    const excerpt = thread.body.length > 80 ? `${thread.body.slice(0, 80)}…` : thread.body

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: `${excerpt} — ${title}`, url })
        return
      } catch {
        return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      toast?.add({ severity: 'success', summary: 'Ссылка скопирована', detail: 'Можете отправить её кому угодно', life: 2500 })
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло скопировать ссылку', life: 2500 })
    }
  }

  return { shareThread }
}
