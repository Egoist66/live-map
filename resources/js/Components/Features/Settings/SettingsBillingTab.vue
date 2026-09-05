<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'

defineProps<{ user: any; zoneCount: number }>()
const emit = defineEmits<{ (e: 'profile'): void }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Тариф и лимиты</h3>
      <p class="text-sm text-stone-500 mt-1">Метрики твоего плана — перенесены с дашборда сюда.</p>
      <div class="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">План</div><div class="font-black text-base capitalize dark:text-white">{{ user.plan || 'free' }}</div><div class="text-xs text-stone-500">{{ user.plan === 'free' ? '3 пина/день · 5 км · 4ч' : user.plan === 'pro' ? 'Безлимит · 15 км · 12ч' : 'Безлимит · 50+ км · ∞' }}</div></template></Card>
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">Пинов сегодня</div><div class="font-black text-base dark:text-white">{{ user.pins_today_count || 0 }}/{{ user.plan === 'free' ? 3 : '∞' }}</div><div class="text-xs text-stone-500">лимит — 3 живых · истёкшие освобождают место</div></template></Card>
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">Подписки</div><div class="font-black text-base dark:text-white">{{ zoneCount }}</div><div class="text-xs text-stone-500">уведомления</div></template></Card>
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">Радиус</div><div class="font-black text-base dark:text-white">{{ user.home_radius_km || 2 }} км</div><div class="text-xs text-stone-500">{{ user.home_lat ? 'дом задан' : 'не задан' }}</div></template></Card>
      </div>
      <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none mt-5" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
        <template #content>
          <div class="text-sm font-bold dark:text-white">Сменить тариф — в разделе Профиль</div>
          <p class="text-xs text-stone-500 mt-1">Free / Pro $4.99 / Business $19.99 — переключай внизу формы профиля.</p>
          <button @click="emit('profile')" class="mt-3 text-sm font-bold bg-stone-900 text-white rounded-full px-4 py-2">К выбору тарифа →</button>
        </template>
      </Card>
    </template>
  </Card>
</template>
