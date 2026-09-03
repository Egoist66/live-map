<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import { Head, useForm } from '@inertiajs/vue3'
import { ref } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
const form = useForm({ password: '' })
const show = ref(false)
const submit = () => { form.post(route('password.confirm'), { onFinish: () => form.reset() }) }
</script>
<template>
  <GuestLayout>
    <Head title="Подтвердите пароль" />
    <Message severity="info" :closable="false" class="!rounded-2xl">Это защищённый раздел. Подтвердите пароль, чтобы продолжить.</Message>
    <form @submit.prevent="submit" class="mt-4 space-y-4">
      <div>
        <label class="text-[13px] font-semibold dark:text-white">Пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="form.password" :type="show ? 'text' : 'password'" placeholder="••••••••" class="w-full pr-11 !rounded-2xl" :invalid="!!form.errors.password" required autocomplete="current-password" autofocus />
          <Button type="button" @click="show=!show" text rounded class="!absolute !right-1.5 !top-1/2 !-translate-y-1/2 !w-8 !h-8 !p-0" :icon="show ? 'pi pi-eye-slash' : 'pi pi-eye'" tabindex="-1" />
        </div>
        <Message v-if="form.errors.password" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.password }}</Message>
      </div>
      <div class="flex justify-end">
        <Button type="submit" :loading="form.processing" label="Подтвердить" class="!bg-ink-900 dark:!bg-white !border-ink-900 dark:!border-white !text-white dark:!text-ink-900 !rounded-full !px-6 !font-bold" />
      </div>
    </form>
  </GuestLayout>
</template>
