<script setup lang="ts">
import Card from 'primevue/card'
import UpdatePasswordForm from '@/Pages/Profile/Partials/UpdatePasswordForm.vue'
import DeleteUserForm from '@/Pages/Profile/Partials/DeleteUserForm.vue'
import SettingsScreenLock from '@/Components/Features/Settings/SettingsScreenLock.vue'
</script>
<template>
  <div class="space-y-4">
    <SettingsScreenLock />
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }"><template #content><UpdatePasswordForm class="max-w-xl" /></template></Card>
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }"><template #content><DeleteUserForm class="max-w-xl" /></template></Card>
  </div>
</template>
