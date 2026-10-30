<script setup lang="ts">
import Card from 'primevue/card'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import { useAppHotkeys } from '@/composables/useAppHotkeys'

const hotkeys = useAppHotkeys()
</script>
<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-black tracking-tight text-lg dark:text-white">Горячие клавиши</h3>
          <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Десктоп: переходы, действия и поиск без мыши. В полях ввода не срабатывают.</p>
        </div>
        <ToggleSwitch :modelValue="hotkeys.enabled.value" @update:modelValue="(v:boolean)=>hotkeys.setEnabled(v)" class="shrink-0" />
      </div>
      <div class="mt-5 space-y-5">
        <div v-for="group in hotkeys.groups.value" :key="group.id">
          <div class="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">{{ group.label }}</div>
          <div class="mt-2 space-y-1.5">
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="w-full flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-white/10 px-3.5 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-white/[0.06] active:scale-[0.99] transition disabled:opacity-50"
              :disabled="!hotkeys.enabled.value"
              @click="hotkeys.runHotkey(item.id)"
              :title="item.desc"
            >
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-semibold dark:text-white truncate">{{ item.title }}</span>
                <span class="block text-xs text-stone-500 dark:text-zinc-400 truncate">{{ item.desc }}</span>
              </span>
              <span class="flex gap-1 shrink-0">
                <kbd v-for="k in item.keys" :key="k" class="px-2 py-1 rounded-lg bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10 text-[11px] font-bold text-stone-600 dark:text-zinc-300 whitespace-nowrap">{{ k }}</kbd>
              </span>
            </button>
          </div>
        </div>
      </div>
      <div class="mt-5 flex items-center gap-2">
        <Button label="Все клавиши" icon="pi pi-keyboard" size="small" rounded outlined @click="hotkeys.setHelp(true)" :disabled="!hotkeys.enabled.value" />
        <span class="text-xs text-stone-400 dark:text-zinc-500">Нажми <kbd class="px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10 font-bold">?</kbd> в любом месте</span>
      </div>
    </template>
  </Card>
</template>
