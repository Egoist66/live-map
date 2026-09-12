import { ref } from 'vue'
import { api } from '@/services/api'

/** Максимум символов короткой мысли. */
export const THOUGHT_MAX_LENGTH = 140

/**
 * Быстрое редактирование короткой мысли профиля (строка под именем).
 *
 * Открывает диалог, сохраняет через PATCH /profile/thought
 * и вставляет в UI запись, возвращённую бэком, без перезагрузки страницы.
 *
 * @param initial геттер текущего значения мысли
 * @param options необязательный колбэк после сохранения
 * @returns состояние диалога и действия
 * @example
 * const thought = useProfileThought(() => props.profileUser.thought)
 * await thought.save()
 */
export function useProfileThought(
  initial: () => string | null | undefined,
  options: { onSaved?: (thought: string | null) => void } = {},
) {
  const open = ref(false)
  const draft = ref('')
  const saving = ref(false)
  const error = ref<string | null>(null)
  const committed = ref<string | null | undefined>(undefined)

  /** Открывает диалог с текущим текстом. */
  function openDialog(): void {
    const current = committed.value === undefined ? initial() : committed.value
    draft.value = (current ?? '').trim()
    error.value = null
    open.value = true
  }

  /** Закрывает диалог без сохранения. */
  function close(): void {
    open.value = false
  }

  /**
   * Обновляет черновик из инпута.
   * @param value новый текст
   */
  function setDraft(value: string): void {
    draft.value = value
  }

  /**
   * Строка для UI: сохранённое значение, иначе фолбэк.
   *
   * @param current актуальная строка (мысль или «О себе»)
   * @param emptyFallback строка при очищенной мысли (текст «О себе»)
   * @returns текст для отображения под именем
   */
  function display(current: string, emptyFallback: string): string {
    if (committed.value === undefined) return current
    return committed.value ?? emptyFallback
  }

  /** Сохраняет черновик и вставляет ответ бэка в UI. */
  async function save(): Promise<void> {
    const value = draft.value.trim().slice(0, THOUGHT_MAX_LENGTH)
    const next = value === '' ? null : value
    saving.value = true
    error.value = null
    try {
      const res = await api.patch('/profile/thought', { thought: next })
      const returned = (res.data as any)?.thought
      const saved = typeof returned === 'string' ? returned : next
      committed.value = saved
      open.value = false
      options.onSaved?.(saved)
    } catch {
      error.value = 'Не удалось сохранить мысль'
    } finally {
      saving.value = false
    }
  }

  return { open, draft, saving, error, committed, openDialog, close, setDraft, display, save }
}
