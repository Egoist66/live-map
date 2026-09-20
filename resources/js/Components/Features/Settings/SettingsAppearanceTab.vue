<script setup lang="ts">
import Card from 'primevue/card'
import ToggleSwitch from 'primevue/toggleswitch'
import { useAppearanceTheme } from '@/composables/useAppearanceTheme'
import { useMotion } from '@/composables/useMotion'
import { useProfileLayout } from '@/composables/useProfileLayout'

defineProps<{ theme?: any }>()
const emit = defineEmits<{ (e: 'theme', v: any): void }>()
const { options, active, hint, select } = useAppearanceTheme()
const { motionOff, setMotionOff } = useMotion()
const { columns, columnOptions, columnsHint, selectColumns } = useProfileLayout()

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
      <div class="mt-4 pt-4 border-t border-stone-200/70 dark:border-zinc-800">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-bold tracking-tight text-[15px] dark:text-white leading-tight">Анимации</h3>
            <p class="text-xs text-stone-500 mt-0.5 truncate">Выключить переходы и эффекты для скорости</p>
          </div>
          <ToggleSwitch :modelValue="motionOff" @update:modelValue="(v:boolean)=>setMotionOff(v)" input-id="appearance-motion-off" class="shrink-0" />
        </div>
      </div>
      <div class="mt-4 pt-4 border-t border-stone-200/70 dark:border-zinc-800">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-bold tracking-tight text-[15px] dark:text-white leading-tight">Вид профиля</h3>
            <p class="text-xs text-stone-500 mt-0.5 truncate">{{ columnsHint }}</p>
          </div>
          <span class="shrink-0 w-8 h-8 rounded-xl grid place-items-center text-sm bg-blue-600/10 text-blue-600"><i class="pi pi-th-large text-xs" /></span>
        </div>
        <div class="mt-3 flex items-center gap-1 p-1 rounded-2xl bg-stone-100 dark:bg-zinc-800 max-w-xl" role="tablist" aria-label="Колонки профиля">
          <button
            v-for="o in columnOptions"
            :key="o.v"
            type="button"
            role="tab"
            :aria-selected="columns === o.v"
            @click="selectColumns(o.v)"
            :class="[
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all',
              columns === o.v
                ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200',
            ]"
          >
            <i :class="[o.icon, 'text-[13px]']" />
            <span>{{ o.label }}</span>
          </button>
        </div>
      </div>
    </template>
  </Card>
</template>
