<script setup lang="ts">
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'

defineProps<{ quest: any }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-start gap-3">
        <span :class="['w-10 h-10 rounded-2xl grid place-items-center shrink-0', quest.completed ? 'bg-emerald-500/15 text-emerald-500' : 'bg-violet-500/15 text-violet-500']"><i :class="[quest.icon]" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-black text-stone-900 dark:text-white">{{ quest.title }}</span>
            <Tag v-if="quest.completed" :value="`+${quest.xp} очков ✓`" severity="success" class="!text-[10px] !rounded-full" />
            <Tag v-else :value="`+${quest.xp} очков`" severity="info" class="!text-[10px] !rounded-full" />
          </div>
          <div class="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">{{ quest.desc }}</div>
          <div class="text-[11px] text-stone-400 dark:text-zinc-500 mt-1">💡 {{ quest.hint }}</div>
          <div class="mt-2 flex items-center gap-2">
            <ProgressBar :value="quest.percent" :show-value="false" class="!h-2 !flex-1" />
            <span class="text-[11px] font-bold text-stone-500 dark:text-zinc-400 whitespace-nowrap">{{ Math.min(quest.progress, quest.target) }}/{{ quest.target }}</span>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
