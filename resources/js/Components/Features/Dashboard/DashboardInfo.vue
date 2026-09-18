<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import { useGender } from '@/composables/useGender'
import { useInfoTileStyle } from '@/composables/useInfoTileStyle'

defineProps<{ user: any; bioEmpty: boolean; bioText: string; isOwn: boolean; settingsHref: string; presence: { active: boolean; label: string } }>()
const g = useGender()
const tiles = useInfoTileStyle()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft !overflow-hidden" :pt="{ body: { class: '!p-0' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="p-4 sm:p-6 min-w-0 w-full max-w-full">
        <h3 class="font-black tracking-tight text-[15px] sm:text-base dark:text-white">Общая информация</h3>
        <p class="text-xs text-stone-500 mt-1">Профиль · видимость · приватность</p>
        <div class="mt-5 grid gap-2.5 min-w-0">
          <div :class="tiles.rowCls">
            <span :class="tiles.iconFor('status')"><i class="pi pi-circle-fill !text-xs"></i></span>
            <div class="min-w-0 flex-1"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">Статус</div><div class="text-sm font-bold truncate" :class="presence.active ? 'text-emerald-600' : 'text-stone-500'">{{ presence.label }}</div></div>
            <span class="w-2 h-2 rounded-full shrink-0" :class="presence.active ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]' : 'bg-stone-300'"></span>
          </div>          <div :class="tiles.rowCls">
            <span :class="tiles.iconFor('name')"><i class="pi pi-user"></i></span>
            <div class="min-w-0 flex-1"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">Имя</div><div class="text-sm font-bold truncate">{{ user.name }}</div></div>
          </div>
          <div :class="tiles.rowCls">
            <span :class="tiles.iconFor('gender')"><i :class="tiles.genderIconFor(user.gender)"></i></span>
            <div class="min-w-0 flex-1"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">Пол</div><div class="text-sm font-bold truncate">{{ g.getLabel(user.gender) }}</div></div>
          </div>
          <div :class="tiles.rowCls">
            <span :class="tiles.iconFor('email')"><i class="pi pi-envelope"></i></span>
            <div class="min-w-0 flex-1"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">Email</div><div class="text-sm font-semibold truncate">{{ user.email }}</div></div>
            <Tag v-if="user.email_verified_at" value="✓" class="!text-[10px] !bg-emerald-50 !text-emerald-700 !rounded-full !inline-flex shrink-0" />
            <Tag v-else value="!" class="!text-[10px] !bg-amber-50 !text-amber-700 !rounded-full !inline-flex shrink-0" />
          </div>
          <Card class="!bg-stone-50 !border-stone-100 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-3' }, content: { class: '!p-0' } }">
            <template #content>
              <div class="flex items-center gap-2"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">О себе</div><Link v-if="isOwn" :href="settingsHref" class="ml-auto text-[11px] font-bold text-violet-600 hover:underline">изменить</Link></div>
              <div v-if="!bioEmpty" class="mt-2.5 text-sm leading-relaxed text-stone-700 whitespace-pre-wrap break-words">{{ bioText }}</div>
              <div v-else class="mt-2 text-sm text-stone-500">{{ isOwn ? 'Расскажи о себе — это видят другие. Добавь в настройках.' : 'Пользователь пока ничего не рассказал о себе.' }}</div>
            </template>
          </Card>
          <div :class="tiles.rowCls">
            <span :class="tiles.iconFor('home')"><i class="pi pi-home"></i></span>
            <div class="min-w-0 flex-1"><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400">Домашняя зона</div><div class="text-sm font-bold truncate">{{ user.home_lat && user.home_lng ? `${Number(user.home_lat).toFixed(4)}, ${Number(user.home_lng).toFixed(4)}` : 'не задана' }}</div></div>
            <Tag :value="`${user.home_radius_km || 2} км`" class="!rounded-full !bg-stone-900 !text-white !border-0 !text-xs !font-black" />
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
