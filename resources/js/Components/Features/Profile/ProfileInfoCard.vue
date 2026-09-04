<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useGender } from '@/composables/useGender'

defineProps<{ user: any; bioEmpty: boolean; bioText: string; levelName: string; registeredAt: string }>()
const g = useGender()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black">Основная информация</h3>
      <Card class="!bg-stone-50 !border-stone-200 !rounded-3xl !shadow-none mt-4" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
        <template #content>
          <div class="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-stone-400">О себе</div>
          <div v-if="!bioEmpty" class="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words">{{ bioText }}</div>
          <div v-else class="mt-2 text-sm text-stone-500">Пользователь пока ничего не рассказал о себе.</div>
        </template>
      </Card>
      <div class="mt-4 space-y-3 text-sm">
        <div class="flex justify-between py-2.5 border-b border-stone-100"><span class="text-stone-500">Имя</span><Tag :value="user.name" class="!bg-stone-100 !text-stone-900 !border-0 !font-semibold" /></div>
        <div class="flex justify-between py-2.5 border-b border-stone-100"><span class="text-stone-500">Пол</span><Tag :value="g.getLabel(user.gender)" class="!bg-stone-100 !text-stone-900 !border-0 !font-semibold" /></div>
        <div class="flex justify-between py-2.5 border-b border-stone-100"><span class="text-stone-500">Уровень</span><Tag :value="levelName" class="!bg-stone-900 !text-white !border-0 !font-semibold !rounded-full" /></div>
        <div class="flex justify-between py-2.5 border-b border-stone-100"><span class="text-stone-500">Репутация</span><span class="font-semibold">{{ user.reputation_score || 0 }}</span></div>
        <div class="flex justify-between py-2.5"><span class="text-stone-500">Дата регистрации</span><span class="font-semibold">{{ registeredAt }}</span></div>
      </div>
      <div class="mt-6"><Link href="/map" class="flex w-full min-w-0"><Button label="На карту →" rounded class="w-full !bg-stone-900 dark:!bg-white dark:!text-ink-900 !text-white [&_.p-button-label]:whitespace-nowrap" /></Link></div>
    </template>
  </Card>
</template>
