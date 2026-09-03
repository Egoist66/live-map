<script setup>
import { computed } from 'vue';
import GuestLayout from '@/Layouts/GuestLayout.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import { Head, Link, useForm } from '@inertiajs/vue3';

const props = defineProps({
    status: {
        type: String,
    },
});

const form = useForm({});

const submit = () => {
    form.post(route('verification.send'));
};

const verificationLinkSent = computed(
    () => props.status === 'verification-link-sent',
);
</script>

<template>
    <GuestLayout>
        <Head title="Подтверждение почты" />

        <div class="mb-4 text-sm text-stone-600 dark:text-zinc-400">
            Спасибо за регистрацию! Подтвердите почту, перейдя по ссылке из письма. Если не получили — отправим заново.
        </div>

        <div
            class="mb-4 text-sm font-medium text-green-600"
            v-if="verificationLinkSent"
        >
            Новая ссылка отправлена на указанный при регистрации email.
        </div>

        <form @submit.prevent="submit">
            <div class="mt-4 flex items-center justify-between">
                <PrimaryButton
                    :class="{ 'opacity-25': form.processing }"
                    :disabled="form.processing"
                >
                    Отправить заново
                </PrimaryButton>

                <Link
                    :href="route('logout')"
                    method="post"
                    as="button"
                    class="rounded-md text-sm text-stone-600 dark:text-zinc-400 underline hover:text-ink-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                    >Выйти</Link
                >
            </div>
        </form>
    </GuestLayout>
</template>
