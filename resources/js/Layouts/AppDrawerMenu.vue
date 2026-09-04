<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import ApplicationLogo from '@/Components/Brand/ApplicationLogo.vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'

defineProps<{ open: boolean; user: any; avatarSrc: string; dashboardHref: string; settingsHref: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'logout'): void }>()
</script>
<template>
  <Drawer :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" position="right" class="!w-[86vw] !max-w-[320px] !bg-white dark:!bg-zinc-900" :pt="{ root: { class: '!bg-white dark:!bg-zinc-900 !border-l !border-stone-200 dark:!border-zinc-800' }, header: { class: '!bg-white dark:!bg-zinc-900 !text-ink-900 dark:!text-white !border-b !border-stone-200 dark:!border-zinc-800' }, content: { class: '!bg-white dark:!bg-zinc-900 !text-stone-700 dark:!text-zinc-200' }, footer: { class: '!bg-white dark:!bg-zinc-900 !border-t !border-stone-200 dark:!border-zinc-800' } }" header="Меню">
    <template #header><ApplicationLogo /></template>
    <div class="space-y-1">
      <Link :href="dashboardHref" class="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="emit('update:open', false)">Профиль</Link>
      <Link :href="settingsHref" class="flex p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="emit('update:open', false)">Настройки</Link>
      <Link :href="route('map')" class="flex p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="emit('update:open', false)">Карта</Link>
      <Link :href="route('chat')" class="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="emit('update:open', false)">Чат</Link>
      <Link :href="route('faq')" class="flex p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="emit('update:open', false)">FAQ</Link>
      <Link href="/map" class="flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-4 py-2.5 text-sm font-semibold justify-center mt-2" @click="emit('update:open', false)">+ Создать пин</Link>
    </div>
    <template #footer>
      <div class="flex items-center gap-3 p-3 border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Avatar :image="avatarSrc" shape="circle" />
        <div class="min-w-0 flex-1"><div class="text-sm font-semibold truncate text-ink-900 dark:text-white">{{ user?.name }}</div><div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ user?.email }}</div></div>
        <Button icon="pi pi-sign-out" severity="secondary" text rounded @click="emit('logout')" />
      </div>
    </template>
  </Drawer>
</template>
