<script setup lang="ts">
import Card from 'primevue/card'
import { useAppearanceTheme } from '@/composables/useAppearanceTheme'

defineProps<{ theme?: any }>()
const emit = defineEmits<{ (e: 'theme', v: any): void }>()
const { options, active, hint, select } = useAppearanceTheme()

function onSelect(v: any) {
  select(v)
  emit('theme', v)
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-bold tracking-tight text-[15px] dark:text-white leading-tight">Внешний вид</h3>
          <p class="text-xs text-stone-500 mt-0.5 truncate">{{ hint }}</p>
        </div>
        <span class="shrink-0 w-8 h-8 rounded-xl grid place-items-center text-sm bg-violet-600/10 text-violet-600"><i class="pi pi-palette text-xs" /></span>
      </div>
      <div class="mt-3 flex items-center gap-1 p-1 rounded-2xl bg-stone-100 dark:bg-zinc-800 max-w-xl" role="tablist" aria-label="Тема оформления">
        <button
          v-for="o in options"
          :key="o.v"
          type="button"
          role="tab"
          :aria-selected="active === o.v"
          @click="onSelect(o.v)"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all',
            active === o.v
              ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-white shadow-sm'
              : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200',
          ]"
        >
          <i :class="[o.icon, 'text-[13px]']" />
          <span>{{ o.label }}</span>
        </button>
      </div>
    </template>
  </Card>
</template>
