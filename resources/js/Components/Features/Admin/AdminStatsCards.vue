<script setup lang="ts">
import Card from 'primevue/card'

defineProps<{ overview: any | null; pct: number; loading: boolean }>()
</script>
<template>
  <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
    <Card class="!bg-stone-900 dark:!bg-zinc-900 !text-white !border-0 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="text-[11px] uppercase tracking-wider text-white/50 font-bold">Всего пользователей</div>
        <div class="mt-1 text-2xl sm:text-3xl font-black">{{ loading ? '…' : (overview?.total_users ?? 0) }}</div>
        <div class="mt-1 text-xs text-white/50">+{{ overview?.new_today ?? 0 }} сегодня · +{{ overview?.new_week ?? 0 }} за 7д</div>
      </template>
    </Card>
    <Card class="!bg-emerald-600 dark:!bg-emerald-700 !text-white !border-0 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="text-[11px] uppercase tracking-wider text-white/70 font-bold">Онлайн сейчас</div>
        <div class="mt-1 text-2xl sm:text-3xl font-black flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse inline-block" />{{ loading ? '…' : (overview?.online_users ?? 0) }}</div>
        <div class="mt-1 text-xs text-white/70">{{ pct }}% базы · активных сегодня {{ overview?.active_today ?? 0 }}</div>
      </template>
    </Card>
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="text-[11px] uppercase tracking-wider text-stone-400 dark:text-zinc-500 font-bold">Новые / активные</div>
        <div class="mt-1 text-2xl sm:text-3xl font-black dark:text-white">{{ overview?.new_month ?? 0 }}<span class="text-sm font-semibold text-stone-400 dark:text-zinc-500"> / 30д</span></div>
        <div class="mt-1 text-xs text-stone-500 dark:text-zinc-400">активных за 7д: {{ overview?.active_week ?? 0 }}</div>
      </template>
    </Card>
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="text-[11px] uppercase tracking-wider text-stone-400 dark:text-zinc-500 font-bold">Контент / жалобы</div>
        <div class="mt-1 text-2xl sm:text-3xl font-black dark:text-white">{{ overview?.active_pins ?? 0 }}<span class="text-sm font-semibold text-stone-400 dark:text-zinc-500"> пинов</span></div>
        <div class="mt-1 text-xs dark:text-zinc-400" :class="(overview?.reports_pending ?? 0) > 0 ? 'text-red-500 dark:text-red-400 font-bold' : 'text-stone-500'">{{ overview?.reports_pending ?? 0 }} жалоб в ожидании</div>
      </template>
    </Card>
  </div>
</template>
