import { nextTick, onMounted, readonly, ref } from 'vue'

/**
 * Флаг «клиент готов»: становится `true` после монтирования и полного
 * завершения стартовой гидратации (mounted + `nextTick`).
 *
 * Зачем: сырые `<Teleport to="body">` + `<Transition>` (скринлок, модалки,
 * вьюверы фото) при SSR-гидратации падают с
 * `TypeError: Cannot read properties of null (reading 'insertBefore')`
 * в `Teleport.process`, если их содержимое переключается `v-if` синхронно
 * с гидратацией (состояние из localStorage/API подтягивается в `onMounted`
 * — сервер этого не видел). PrimeVue от этого защищён изнутри (`Portal`
 * рендерит Teleport только после `mounted`), наш код — нет.
 *
 * Паттерн: гейтить блок оверлеев в layout за `isClientReady`, чтобы Teleport
 * создавались уже после settled-hydration. Визуально ничего не меняется:
 * на сервере эти оверлеи всё равно закрыты (пустые), пользы от их SSR нет.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useClientReady } from '@/composables/useClientReady'
 *
 * const { isClientReady } = useClientReady()
 * </script>
 *
 * <template>
 *   <ScreenLockOverlay v-if="isClientReady" />
 * </template>
 * ```
 *
 * @returns объект с readonly-флагом `isClientReady`
 */
export function useClientReady() {
  const ready = ref(false)

  onMounted(() => {
    void nextTick(() => {
      ready.value = true
    })
  })

  return { isClientReady: readonly(ready) }
}
