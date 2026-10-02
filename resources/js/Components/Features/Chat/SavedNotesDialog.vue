<script setup lang="ts">
import Dialog from 'primevue/dialog'
import SavedNotesChat from '@/Components/Features/Chat/SavedNotesChat.vue'

/**
 * Диалог «Избранное» — чат с собой прямо там, где нажали звёздочку.
 *
 * Единственное место «Избранного» в вебе: тот же `SavedNotesChat`
 * (шапка, лента, композер), только внутри PrimeVue Dialog. Шапку
 * диалога прячем (`show-header=false`), чтобы не дублировалась, —
 * крестик дорисовывает сам чат через `show-close`. На мобиле
 * превращается в нижнюю шторку (глобальный bottom-sheet CSS),
 * свайп-пилюлю ставит `useGlobalDialogDismiss`.
 *
 * @example
 * <SavedNotesDialog :open="savedNotesOpen" @update:open="savedNotesOpen = $event" />
 */
defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

/**
 * Закрыть диалог (крестик в шапке чата, Esc, клик по маске).
 */
function close(): void {
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :visible="open"
    modal
    :show-header="false"
    :dismissable-mask="true"
    :draggable="false"
    :block-scroll="true"
    aria-label="Избранное — чат с собой"
    :style="{ width: '480px', maxWidth: '96vw' }"
    :pt="{
      root: { class: '!rounded-3xl !overflow-hidden !border-stone-200 dark:!border-zinc-700' },
      content: { class: '!p-0 !overflow-hidden !bg-white dark:!bg-zinc-900' },
    }"
    @update:visible="(v: boolean) => emit('update:open', v)"
  >
    <div class="flex min-h-0 flex-col h-[86dvh] sm:h-[660px] sm:max-h-[86dvh]">
      <SavedNotesChat embedded show-close @close="close" />
    </div>
  </Dialog>
</template>
