<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useAppHotkeys } from '@/composables/useAppHotkeys'

const hotkeys = useAppHotkeys()
</script>
<template>
  <Dialog :visible="hotkeys.showHelp.value" @update:visible="(v:boolean)=>hotkeys.setHelp(v)" modal header="Горячие клавиши" :style="{ width: '440px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none' } }">
    <div class="space-y-4">
      <div v-for="group in hotkeys.groups.value" :key="group.id">
        <div class="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">{{ group.label }}</div>
        <div class="mt-1.5 space-y-1">
          <div v-for="item in group.items" :key="item.id" class="flex items-center gap-3 text-sm">
            <span class="flex-1 min-w-0 truncate dark:text-white">{{ item.title }} <span class="text-stone-400 dark:text-zinc-500">· {{ item.desc }}</span></span>
            <span class="flex gap-1 shrink-0">
              <kbd v-for="k in item.keys" :key="k" class="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-[11px] font-bold text-stone-600 dark:text-zinc-300 whitespace-nowrap">{{ k }}</kbd>
            </span>
          </div>
        </div>
      </div>
      <p class="text-xs text-stone-400 dark:text-zinc-500">Только десктоп с физической клавиатурой. В полях ввода клавиши не срабатывают, <kbd class="px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 font-bold">Esc</kbd> закрывает окно.</p>
    </div>
    <template #footer>
      <Button label="Понятно" rounded @click="hotkeys.setHelp(false)" class="w-full" />
    </template>
  </Dialog>
</template>
