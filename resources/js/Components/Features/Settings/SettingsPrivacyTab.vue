<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

import SettingsHiddenFriends from './SettingsHiddenFriends.vue'
import HomeZoneField from '@/Components/Features/HomeZone/HomeZoneField.vue'
import { planOf } from '@/composables/usePlanLimits'
defineProps<{ user: any; invisible: any; hidden?: any; blur: any; photoPrivacy?: any; homeRadius?: any }>()
const emit = defineEmits<{ (e: 'profile'): void }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Приватность</h3>
      <p class="text-sm text-stone-500 mt-1">Ты — не точка, ты — пин. Управляй видимостью своей геопозиции и анонимностью.</p>
      <div class="mt-5 space-y-4 max-w-xl">
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Базовые принципы</div>
            <ul class="text-sm text-stone-600 mt-2 space-y-1 list-disc pl-5">
              <li>Твоя точка на карте всегда одна и пульсирует — видна только сдвинутая позиция</li>
              <li>Пины всегда точные — чтобы люди знали, где событие</li>
              <li>Анонимный пин скрывает имя и репутацию</li>
              <li>Блокировка в 1 клик скрывает контент пользователя</li>
            </ul>
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold dark:text-white">Моя геопозиция · {{ blur.blurLabel.value }}</div>
                <p class="text-xs text-stone-500 mt-1 leading-relaxed">Насколько сдвигать твою пульсирующую точку от реального места. Координаты точки меняются соответственно.</p>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button v-for="o in blur.options" :key="o.v" type="button" @click="blur.setMeters(o.v)" :disabled="!!o.pro && !blur.canUse5km.value" :title="!!o.pro && !blur.canUse5km.value ? 'Только Pro' : o.d" :class="['px-2 py-2 rounded-xl border text-center transition active:scale-95 disabled:opacity-50', blur.blurMeters.value === o.v ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-stone-700 dark:text-zinc-100']">
                <span class="block text-xs font-bold leading-none">{{ o.l }}</span><span class="block text-[10px] opacity-60 leading-none mt-1">{{ o.pro && !blur.canUse5km.value ? 'PRO' : o.d }}</span>
              </button>
            </div>
            <div v-if="blur.saving.value" class="text-xs text-stone-400 mt-2">Сохраняем…</div>
            <div v-else-if="blur.saved.value && !blur.dirty.value" class="text-xs text-emerald-600 mt-2">✓ Запомнили — твоя точка сдвинута на «{{ blur.blurLabel.value }}»</div>
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Радиус зоны — где вижу и ставлю пины</div>
            <p class="text-xs text-stone-500 mt-1 leading-relaxed">Создавать и видеть чужие пины можно только внутри зоны. Вне зоны операция запрещена. Free — до 10 км, больше — Pro/Business. Админ — без ограничений.</p>
            <div v-if="homeRadius" class="mt-3">
              <HomeZoneField :model-value="homeRadius.radius.value" :plan="String(homeRadius.plan.value)" :error="homeRadius.error.value" @update:model-value="(v:number)=>homeRadius.save(v)" />
              <div v-if="homeRadius.saving.value" class="text-xs text-stone-400 mt-2">Сохраняем…</div>
            </div>
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Режим анонимности по умолчанию</div>
            <p class="text-xs text-stone-500 mt-1">Настраивается в разделе «Профиль» — переключатель «Анонимно по умолчанию».</p>
            <Button @click="emit('profile')" label="Перейти в Профиль →" rounded size="small" class="!bg-stone-900 !border-stone-900 !text-white mt-3" />
          </template>
        </Card>
        <Card class="!border-stone-200 !rounded-3xl !shadow-none" :class="invisible.isInvisible.value ? '!bg-violet-50 !border-violet-200' : ''" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold dark:text-white flex items-center gap-2">Режим «Невидимка» <Tag v-if="invisible.canUse.value" value="PRO" class="!bg-violet-600 !text-white !border-0 !text-[10px]" /><Tag v-else value="PRO only" class="!bg-stone-200 !text-stone-600 !border-0 !text-[10px]" /></div>
                <p class="text-xs text-stone-500 mt-1 leading-relaxed">Скрывает твой онлайн-статус — для других ты оффлайн.</p>
              </div>
              <ToggleSwitch :modelValue="invisible.isInvisible.value" @update:modelValue="(v:boolean)=>invisible.toggle(v)" :disabled="!invisible.canUse.value || invisible.loading.value" />
            </div>
            <Message v-if="!invisible.canUse.value" severity="warn" :closable="false" class="!mt-3 !rounded-2xl !text-xs">Нужен тариф Pro/Business или права админа. Сейчас у тебя {{ planOf(user) }}.</Message>
            <Message v-if="invisible.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ invisible.error.value }}</Message>
          </template>
        </Card>
        <SettingsHiddenFriends v-if="hidden" :hidden="hidden" />
        <Card v-if="photoPrivacy" class="!border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Кто может комментировать мои фото</div>
            <p class="text-xs text-stone-500 mt-1 leading-relaxed">Галерея в профиле: 3 фото на Free, 6 на Pro, 15 на Business.</p>
            <div class="mt-3 grid gap-1.5">
              <button v-for="o in photoPrivacy.options" :key="o.value" type="button" @click="photoPrivacy.save(o.value)" :disabled="photoPrivacy.saving.value" :class="['flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border text-left transition active:scale-[0.99] disabled:opacity-60', photoPrivacy.value.value === o.value ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-stone-700 dark:text-zinc-100']">
                <i :class="[o.icon, 'text-sm']" />
                <span class="text-xs font-bold">{{ o.label }}</span>
                <i v-if="photoPrivacy.value.value === o.value" class="pi pi-check ml-auto text-xs" />
              </button>
            </div>
            <div v-if="photoPrivacy.saving.value" class="text-xs text-stone-400 mt-2">Сохраняем…</div>
            <div v-else-if="photoPrivacy.saved.value" class="text-xs text-emerald-600 mt-2">✓ Сохранено</div>
            <Message v-if="photoPrivacy.error.value" severity="error" :closable="false" class="!mt-2 !rounded-2xl !text-xs">{{ photoPrivacy.error.value }}</Message>
          </template>
        </Card>
      </div>
    </template>
  </Card>
</template>
