<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import UpdateProfileInformationForm from '@/Pages/Profile/Partials/UpdateProfileInformationForm.vue'

defineProps<{ mustVerifyEmail: boolean; status?: string | null; bioEmpty: boolean; bioText: string }>()
</script>
<template>
  <div class="space-y-4">
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Основное</h3>
        <p class="text-sm text-stone-500 mt-1">Аватар, контакты и домашняя зона — что видят другие.</p>
        <UpdateProfileInformationForm :must-verify-email="mustVerifyEmail" :status="status" class="mt-5 max-w-xl" />
      </template>
    </Card>
    <Card v-if="!bioEmpty" class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h4 class="text-sm font-black flex items-center gap-2">Превью «О себе» <Tag value="как видят другие" class="!text-xs !font-normal !bg-stone-100 !text-stone-500 !border-0" /></h4>
        <div class="mt-3 bg-stone-50 border rounded-3xl p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-stone-700">{{ bioText }}</div>
      </template>
    </Card>
  </div>
</template>
