<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { usePwaInstallGuide } from '@/composables/usePwaInstallGuide'

const guide = usePwaInstallGuide()
</script>

<template>
  <Dialog
    :visible="guide.guideOpen.value"
    modal
    dismissable-mask
    :draggable="false"
    :closable="true"
    header="Как установить UPin"
    :style="{ width: '380px', maxWidth: 'calc(100vw - 2rem)' }"
    @update:visible="(v: boolean) => { if (!v) guide.closeGuide() }"
  >
    <div class="space-y-2.5">
      <div
        v-for="(step, i) in guide.steps.value"
        :key="i"
        class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 bg-stone-50 dark:bg-white/[0.03] px-4 py-3"
      >
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300">
          <i :class="[step.icon, 'text-sm']"></i>
        </span>
        <p class="text-sm font-medium dark:text-zinc-100">{{ step.text }}</p>
      </div>
    </div>
    <template #footer>
      <Button label="Понятно" rounded class="!border-0 !bg-ink-900 !text-sm !font-bold !text-white dark:!bg-white dark:!text-zinc-900" @click="guide.closeGuide()" />
    </template>
  </Dialog>
</template>
