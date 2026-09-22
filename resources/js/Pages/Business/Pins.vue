<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { h } from 'vue'
import BusinessLayout from '@/Layouts/BusinessLayout.vue'
import { useBusinessPins } from '@/composables/useBusinessPins'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(BusinessLayout, () => child),
})

useSeo({ title: 'Пины компании — UPin Pro', description: 'Все пины компании со статистикой.', noindex: true })

const list = useBusinessPins()
</script>

<template>
  <Head title="Пины компании" />
  <div class="max-w-[760px] mx-auto space-y-3 pb-2">
    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-[22px] sm:text-[26px] font-black tracking-tight dark:text-white">Пины компании</h1>
        <p class="text-[13px] text-stone-500 dark:text-zinc-400 mt-0.5">Живые и запланированные · клик открывает пин на карте</p>
      </div>
      <Link href="/map"><Button label="+ Пин" icon="pi pi-map-marker" rounded class="!bg-gradient-to-r !from-indigo-500 !to-violet-600 !border-0 !text-white" /></Link>
    </div>

    <div class="grid grid-cols-4 gap-2 sm:gap-3">
      <Card class="!rounded-2xl !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm"><template #content><div class="text-center py-1"><div class="text-xl sm:text-2xl font-black dark:text-white">{{ list.totals.value.count }}</div><div class="text-[11px] font-medium text-stone-500 dark:text-zinc-400 uppercase">пинов</div></div></template></Card>
      <Card class="!rounded-2xl !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm"><template #content><div class="text-center py-1"><div class="text-xl sm:text-2xl font-black dark:text-white">{{ list.totals.value.views }}</div><div class="text-[11px] font-medium text-stone-500 dark:text-zinc-400 uppercase">просм.</div></div></template></Card>
      <Card class="!rounded-2xl !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm"><template #content><div class="text-center py-1"><div class="text-xl sm:text-2xl font-black dark:text-white">{{ list.totals.value.likes }}</div><div class="text-[11px] font-medium text-stone-500 dark:text-zinc-400 uppercase">лайков</div></div></template></Card>
      <Card class="!rounded-2xl !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm"><template #content><div class="text-center py-1"><div class="text-xl sm:text-2xl font-black dark:text-white">{{ list.totals.value.comments }}</div><div class="text-[11px] font-medium text-stone-500 dark:text-zinc-400 uppercase">комм.</div></div></template></Card>
    </div>

    <Message v-if="list.error.value" severity="error" class="w-full">{{ list.error.value }}</Message>

    <div v-if="list.loading.value" class="space-y-2">
      <Skeleton v-for="i in 4" :key="i" height="76px" class="!rounded-2xl" />
    </div>
    <div v-else-if="!list.pins.value.length" class="rounded-[24px] border-2 border-dashed border-stone-200 dark:border-zinc-700 p-6 text-center">
      <div class="text-[15px] font-black dark:text-white">Пинов пока нет</div>
      <p class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1">Создайте первый пин на карте — клиенты увидят его рядом.</p>
      <Link href="/map" class="inline-block mt-3"><Button label="Создать пин" icon="pi pi-map-marker" rounded class="!bg-gradient-to-r !from-indigo-500 !to-violet-600 !border-0 !text-white" /></Link>
    </div>
    <div v-else class="space-y-2">
      <Link
        v-for="pin in list.pins.value"
        :key="pin.id"
        :href="`/map?pin=${pin.id}`"
        class="block rounded-2xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-indigo-400 transition active:scale-[0.99]"
      >
        <div class="flex items-center gap-2">
          <div class="text-sm font-bold truncate dark:text-white flex-1">{{ pin.title }}</div>
          <span v-if="pin.is_scheduled" class="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5">план</span>
          <span v-if="pin.is_boosted" class="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 rounded-full px-2 py-0.5">топ</span>
        </div>
        <div v-if="pin.promo" class="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">📢 {{ pin.promo }}</div>
        <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1">👁 {{ pin.views_count ?? 0 }} · ❤ {{ pin.likes_count ?? 0 }} · 💬 {{ pin.comments_count ?? 0 }} · Открыть →</div>
      </Link>
    </div>
  </div>
</template>
