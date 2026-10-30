<script setup lang="ts">
import Card from 'primevue/card'
import UpdatePasswordForm from '@/Pages/Profile/Partials/UpdatePasswordForm.vue'
import DeleteUserForm from '@/Pages/Profile/Partials/DeleteUserForm.vue'
import SettingsScreenLock from '@/Components/Features/Settings/SettingsScreenLock.vue'
import SettingsEmailCard from '@/Components/Features/Settings/SettingsEmailCard.vue'
import SettingsSessionsCard from '@/Components/Features/Settings/SettingsSessionsCard.vue'
</script>
<template>
  <div class="space-y-4">
    <SettingsEmailCard />
    <SettingsScreenLock />
    <SettingsSessionsCard />
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }"><template #content><UpdatePasswordForm class="max-w-xl" /></template></Card>
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }"><template #content><DeleteUserForm class="max-w-xl" /></template></Card>
  </div>
</template>
