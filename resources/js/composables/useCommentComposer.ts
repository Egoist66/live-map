import { computed, ref } from 'vue'
import { useVisualKeyboard } from '@/composables/useVisualKeyboard'

/**
 * Композер комментариев в центральной модалке для тач-устройств.
 *
 * На мобилке системная клавиатура перекрывает нижний инпут карточки пина,
 * поэтому ввод выносится в аккуратный диалог по центру: открылся, написал,
 * нажал «Отправить» — закрылся. На десктопе остаётся обычный инлайн-ввод.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useCommentComposer } from '@/composables/useCommentComposer'
 * const composer = useCommentComposer()
 * </script>
 * ```
 *
 * @returns состояние модалки, режим и подъём над клавиатурой
 */
export function useCommentComposer() {
  const composerOpen = ref(false)
  const composerMode = ref<'create' | 'edit'>('create')
  const { keyboardHeight, isKeyboardOpen } = useVisualKeyboard()

  const coarse = ref(false)
  try {
    coarse.value = window.matchMedia?.('(pointer: coarse)').matches ?? false
  } catch {}

  /**
   * На тач-устройствах ввод идёт через модалку, на десктопе — инлайн.
   */
  const useModalComposer = computed(() => coarse.value)

  /**
   * Подъём диалога над клавиатурой.
   * На Android вьюпорт и так ужимается (interactive-widget), сдвиг нулевой.
   * На iOS вьюпорт не ужимается — сдвигаем на половину высоты клавиатуры,
   * чтобы диалог оказался по центру видимой области.
   */
  const liftStyle = computed((): Record<string, string> => {
    const h = keyboardHeight.value
    if (!isKeyboardOpen.value || !h) {
      return {}
    }
    return { transform: `translateY(${-Math.round(h / 2)}px)` }
  })

  /**
   * Открыть композер.
   * @param mode create для нового/ответа, edit для редактирования
   */
  function openComposer(mode: 'create' | 'edit' = 'create'): void {
    composerMode.value = mode
    composerOpen.value = true
  }

  /**
   * Закрыть композер.
   */
  function closeComposer(): void {
    composerOpen.value = false
  }

  return { composerOpen, composerMode, useModalComposer, liftStyle, openComposer, closeComposer }
}
