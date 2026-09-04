<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

defineProps<{ user: any; invisible: any }>()
const emit = defineEmits<{ (e: 'profile'): void }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Приватность</h3>
      <p class="text-sm text-stone-500 mt-1">Ты — не точка, ты — пин. Управляй размытием и анонимностью.</p>
      <div class="mt-5 space-y-4 max-w-xl">
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Базовые принципы</div>
            <ul class="text-sm text-stone-600 mt-2 space-y-1 list-disc pl-5">
              <li>Размытие 200м по умолчанию — координаты смещаются случайно</li>
              <li>Анонимный пин скрывает имя и репутацию</li>
              <li>Блокировка в 1 клик скрывает контент пользователя</li>
            </ul>
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
                <p class="text-xs text-stone-500 mt-1 leading-relaxed">Скрывает твой онлайн-статус — для других ты офлайн.</p>
              </div>
              <ToggleSwitch :modelValue="invisible.isInvisible.value" @update:modelValue="(v:boolean)=>invisible.toggle(v)" :disabled="!invisible.canUse.value || invisible.loading.value" />
            </div>
            <Message v-if="!invisible.canUse.value" severity="warn" :closable="false" class="!mt-3 !rounded-2xl !text-xs">Нужен тариф Pro/Business или права админа. Сейчас у тебя {{ user.plan || 'free' }}.</Message>
            <Message v-if="invisible.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ invisible.error.value }}</Message>
          </template>
        </Card>
      </div>
    </template>
  </Card>
</template>
