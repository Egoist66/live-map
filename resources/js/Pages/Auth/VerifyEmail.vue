<script setup lang="ts">
import { computed } from 'vue'
import GuestLayout from '@/Layouts/GuestLayout.vue'
import { Head, Link, useForm } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Card from 'primevue/card'
const props = defineProps<{ status?: string | null }>()
const form = useForm({})
const submit = () => { form.post(route('verification.send')) }
const verificationLinkSent = computed(() => props.status === 'verification-link-sent')
</script>
<template>
  <GuestLayout>
    <Head title="Подтверждение почты" />
    <Message severity="info" :closable="false" class="!rounded-2xl">Спасибо за регистрацию! Подтвердите почту, перейдя по ссылке из письма. Если не получили — отправим заново.</Message>
    <Message v-if="verificationLinkSent" severity="success" :closable="false" class="mt-3 !rounded-2xl">Новая ссылка отправлена на указанный при регистрации email.</Message>
    <form @submit.prevent="submit" class="mt-6">
      <div class="flex items-center justify-between gap-3">
        <Button type="submit" :loading="form.processing" label="Отправить заново" class="!bg-ink-900 dark:!bg-[#FAFAFA] !border-ink-900 dark:!border-[#FAFAFA] !text-white dark:!text-[#0F172A] !rounded-full !px-6 !font-bold [&_.p-button-label]:!text-white dark:[&_.p-button-label]:!text-[#0F172A]" />
        <Link :href="route('logout')" method="post" as="button" class="rounded-full text-sm text-stone-600 dark:text-zinc-400 underline hover:text-ink-900 dark:hover:text-white">Выйти</Link>
      </div>
    </form>
  </GuestLayout>
</template>
