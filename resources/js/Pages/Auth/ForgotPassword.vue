<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { route } from '@/route'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Card from 'primevue/card'
const props = defineProps<{ status?: string | null }>()
const form = useForm({ email: '' })
const submit = () => { form.post(route('password.email')) }
</script>
<template>
  <Head title="Восстановление пароля" />
    <Message severity="info" :closable="false" class="mb-4 !rounded-2xl">Забыли пароль? Укажите email, и мы отправим ссылку для сброса пароля.</Message>
    <Message v-if="props.status" severity="success" :closable="false" class="mb-4 !rounded-2xl">{{ props.status }}</Message>
    <form @submit.prevent="submit" class="space-y-4">
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Email</label>
        <InputText v-model="form.email" type="email" placeholder="you@mail.ru" class="w-full mt-1.5 !rounded-2xl" :invalid="!!form.errors.email" required autofocus autocomplete="username" />
        <Message v-if="form.errors.email" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.email }}</Message>
      </div>
      <Button type="submit" :loading="form.processing" label="Отправить ссылку" class="w-full !bg-ink-900 dark:!bg-[#FAFAFA] !border-ink-900 dark:!border-[#FAFAFA] !text-white dark:!text-[#0F172A] !rounded-full !py-3.5 !font-bold [&_.p-button-label]:!text-white dark:[&_.p-button-label]:!text-[#0F172A]" />
    </form>
</template>
