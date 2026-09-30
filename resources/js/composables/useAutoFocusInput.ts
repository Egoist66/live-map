import { nextTick, onMounted, ref, watch, type Ref } from 'vue'
import { useMounted } from '@vueuse/core'

/**
 * Разворачивает ref PrimeVue-инпута (InputText/Textarea) до нативного тега.
 *
 * PrimeVue кладёт DOM в `$el`, иногда это обёртка — ищем вложенные
 * `input`/`textarea`.
 *
 * @param target ref инпута или сырой элемент
 * @returns нативный input/textarea либо null
 */
export function resolveFocusTag(target: unknown): HTMLInputElement | HTMLTextAreaElement | null {
  let el: any = null

  try {
    el = (target as any)?.value ?? target
  } catch {
    return null
  }

  if (!el) {
    return null
  }

  const raw = el?.$el ?? el

  if (raw instanceof HTMLInputElement || raw instanceof HTMLTextAreaElement) {
    return raw
  }

  try {
    const inner = raw?.querySelector?.('input,textarea') ?? null

    if (inner instanceof HTMLInputElement || inner instanceof HTMLTextAreaElement) {
      return inner
    }
  } catch {
    return null
  }

  return null
}

/**
 * Автофокус инпута при открытии: чат, комментарии, просмотр фото.
 *
 * Компонент только биндит `target` на поле ввода — вся логика
 * фокусировки живёт здесь. Фокус ставится на маунт и каждый раз,
 * когда `when` переходит в true (открыли диалог, выбрали чат,
 * развернули комменты).
 *
 * @param when условие видимости инпута (по умолчанию — фокус на маунт)
 * @param delayMs задержка после показа (анимация Dialog — ~150-250мс)
 * @returns ref для бинда на PrimeVue-поле и ручной focus()
 * @example
 * const composerFocus = useAutoFocusInput(computed(() => !!props.selectedId))
 * // <Textarea ref="composerFocus.target" ... />
 */
export function useAutoFocusInput(
  when?: Ref<boolean> | (() => boolean),
  delayMs = 250,
): { target: Ref<any>; focus: () => void } {
  const target = ref<any>(null)
  const isMounted = useMounted()

  function focus(): void {
    nextTick(() => {
      try {
        const el = resolveFocusTag(target.value)

        el?.focus({ preventScroll: true } as FocusOptions)
      } catch {
      }
    })
  }

  function focusSoon(): void {
    focus()
    window.setTimeout(focus, delayMs)
  }

  onMounted(() => {
    if (!when) {
      focusSoon()
      return
    }

    const open = typeof when === 'function' ? when() : when.value

    if (open) {
      focusSoon()
    }
  })

  if (when) {
    watch(
      () => (typeof when === 'function' ? when() : when.value),
      (open, prev) => {
        if (open && !prev && isMounted.value) {
          focusSoon()
        }
      },
    )
  }

  return { target, focus }
}
