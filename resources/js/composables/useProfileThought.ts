import { ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'

/** Максимум символов короткой мысли. */
export const THOUGHT_MAX_LENGTH = 140

/**
 * Быстрое редактирование короткой мысли профиля (строка под именем).
 *
 * Открывает диалог, сохраняет через PATCH /profile/thought
 * и точечно перезагружает данные пользователя.
 *
 * @param initial геттер текущего значения мысли
 * @param reloadKeys ключи пропсов для перезагрузки после сохранения
 * @returns состояние диалога и действия
 * @example
 * const thought = useProfileThought(() => props.profileUser.thought)
 * await thought.save()
 */
export function useProfileThought(initial: () => string | null | undefined, reloadKeys: string[] = ['profileUser']) {
  const open = ref(false)
  const draft = ref('')
  const saving = ref(false)
  const error = ref<string | null>(null)
  const committed = ref<string | undefined>(undefined)

  /** Открывает диалог с текущим текстом. */
  function openDialog(): void {
    draft.value = (initial() ?? '').trim()
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
   * Отправляет мысль на сервер.
   * @param value текст или null для очистки
   */
  function patchThought(value: string | null): Promise<void> {
    return new Promise((resolve, reject) => {
      router.patch(route('profile.thought'), { thought: value }, {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => resolve(),
        onError: () => reject(new Error('Не удалось сохранить мысль')),
      })
    })
  }

  /** Сохраняет черновик, мгновенно показывает его и перезагружает пользователя. */
  async function save(): Promise<void> {
    const value = draft.value.trim().slice(0, THOUGHT_MAX_LENGTH)
    const next = value === '' ? null : value
    saving.value = true
    error.value = null
    try {
      await patchThought(next)
      open.value = false
      committed.value = next ?? ''
      applyLocal(next)
      await reloadUser()
      committed.value = undefined
    } catch {
      error.value = 'Не удалось сохранить мысль'
    } finally {
      saving.value = false
    }
  }

  /**
   * Мгновенно пишет значение в пропсы страницы, не дожидаясь сети.
   * @param value сохранённый текст или null
   */
  function applyLocal(value: string | null): void {
    try {
      const bag = (usePage().props as any)?.[reloadKeys[0]]
      if (bag && typeof bag === 'object') bag.thought = value
    } catch {}
  }

  /** Точечно перезагружает пользователя с сервера. */
  function reloadUser(): Promise<void> {
    return new Promise((resolve) => {
      try {
        router.reload({ only: reloadKeys, onFinish: () => resolve() })
      } catch {
        resolve()
      }
    })
  }

  return { open, draft, saving, error, committed, openDialog, close, setDraft, save }
}
